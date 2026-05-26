package com.ntodo.mobile;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class Todo {
    public String id = UUID.randomUUID().toString();
    public String title = "";
    public int priority = 2;
    public String dueDate = "";
    public long calendarEventId = -1L;
    public boolean pinned = false;
    public boolean done = false;
    public long createdAt = System.currentTimeMillis();

    static Todo fromJson(JSONObject json) throws JSONException {
        Todo todo = new Todo();
        todo.id = json.optString("id", todo.id);
        todo.title = json.optString("title", "");
        todo.priority = json.optInt("priority", 2);
        todo.dueDate = json.optString("dueDate", "");
        todo.calendarEventId = json.optLong("calendarEventId", -1L);
        todo.pinned = json.optBoolean("pinned", false);
        todo.done = json.optBoolean("done", false);
        todo.createdAt = json.optLong("createdAt", System.currentTimeMillis());
        return todo;
    }

    JSONObject toJson() throws JSONException {
        JSONObject json = new JSONObject();
        json.put("id", id);
        json.put("title", title);
        json.put("priority", priority);
        json.put("dueDate", dueDate);
        json.put("calendarEventId", calendarEventId);
        json.put("pinned", pinned);
        json.put("done", done);
        json.put("createdAt", createdAt);
        return json;
    }

    static List<Todo> listFromJson(String raw) {
        List<Todo> todos = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(raw == null ? "[]" : raw);
            for (int i = 0; i < array.length(); i++) {
                todos.add(fromJson(array.getJSONObject(i)));
            }
        } catch (JSONException ignored) {
        }
        return todos;
    }

    static String listToJson(List<Todo> todos) {
        JSONArray array = new JSONArray();
        for (Todo todo : todos) {
            try {
                array.put(todo.toJson());
            } catch (JSONException ignored) {
            }
        }
        return array.toString();
    }
}
