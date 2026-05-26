package com.ntodo.mobile;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class AiTaskParser {
    public static List<Todo> parse(String text, TodoStore store) throws Exception {
        String apiKey = store.apiKey();
        if (apiKey.isEmpty()) throw new IllegalStateException("请先填写 API Key");

        String base = store.baseUrl().replaceAll("/+$", "");
        String endpoint = base.endsWith("/chat/completions") ? base : base + "/chat/completions";
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.CHINA).format(new Date());

        JSONObject body = new JSONObject();
        body.put("model", store.model());
        body.put("temperature", 0.1);
        body.put("stream", false);
        body.put("response_format", new JSONObject().put("type", "json_object"));

        JSONArray messages = new JSONArray();
        messages.put(new JSONObject()
                .put("role", "system")
                .put("content", "你是 Ntodo 的任务解析器，只返回 JSON，不要返回 Markdown。格式：{\"tasks\":[{\"title\":\"任务名\",\"priority\":2,\"dueDate\":\"YYYY-MM-DD 或空字符串\"}]}。今天是 " + today + "。priority 1=低，2=中，3=高。不要编造任务。"));
        messages.put(new JSONObject().put("role", "user").put("content", text));
        body.put("messages", messages);

        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(20000);
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Authorization", "Bearer " + apiKey);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setDoOutput(true);

        try (OutputStream output = connection.getOutputStream()) {
            output.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }

        int code = connection.getResponseCode();
        BufferedReader reader = new BufferedReader(new InputStreamReader(
                code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream(),
                StandardCharsets.UTF_8));
        StringBuilder raw = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) raw.append(line);
        if (code < 200 || code >= 300) throw new IllegalStateException("AI 请求失败：" + code + " " + raw);

        String content = new JSONObject(raw.toString())
                .getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content");
        return todosFromContent(content);
    }

    private static List<Todo> todosFromContent(String content) throws Exception {
        JSONObject parsed = new JSONObject(extractJson(content));
        JSONArray tasks = parsed.optJSONArray("tasks");
        List<Todo> todos = new ArrayList<>();
        if (tasks == null) return todos;

        for (int i = 0; i < tasks.length() && i < 8; i++) {
            JSONObject item = tasks.getJSONObject(i);
            String title = item.optString("title", "").trim();
            if (title.isEmpty()) continue;
            Todo todo = new Todo();
            todo.title = title;
            int priority = item.optInt("priority", 2);
            todo.priority = priority < 1 || priority > 3 ? 2 : priority;
            String dueDate = item.optString("dueDate", "");
            todo.dueDate = dueDate.matches("\\d{4}-\\d{2}-\\d{2}") ? dueDate : "";
            todos.add(todo);
        }
        return todos;
    }

    private static String extractJson(String content) {
        String clean = content == null ? "" : content.trim();
        int first = clean.indexOf('{');
        int last = clean.lastIndexOf('}');
        if (first >= 0 && last > first) return clean.substring(first, last + 1);
        return clean;
    }
}
