package com.ntodo.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class TodoStore {
    private static final String PREFS = "ntodo_mobile";
    private static final String KEY_TODOS = "todos";
    private static final String KEY_API_KEY = "openai_api_key";
    private static final String KEY_BASE_URL = "openai_base_url";
    private static final String KEY_MODEL = "openai_model";

    private final SharedPreferences prefs;

    public TodoStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public List<Todo> readTodos() {
        List<Todo> todos = Todo.listFromJson(prefs.getString(KEY_TODOS, "[]"));
        Collections.sort(todos, Comparator
                .comparingInt((Todo todo) -> todo.done ? 1 : 0)
                .thenComparing((Todo todo) -> todo.pinned ? 0 : 1)
                .thenComparing((Todo todo) -> -todo.priority)
                .thenComparingLong(todo -> todo.createdAt));
        return todos;
    }

    public void writeTodos(List<Todo> todos) {
        prefs.edit().putString(KEY_TODOS, Todo.listToJson(todos)).apply();
    }

    public List<Todo> activeTodos() {
        List<Todo> active = new ArrayList<>();
        for (Todo todo : readTodos()) {
            if (!todo.done) active.add(todo);
        }
        return active;
    }

    public String apiKey() {
        return prefs.getString(KEY_API_KEY, "");
    }

    public String baseUrl() {
        return prefs.getString(KEY_BASE_URL, "https://api.openai.com/v1");
    }

    public String model() {
        return prefs.getString(KEY_MODEL, "gpt-4o-mini");
    }

    public void saveAiSettings(String apiKey, String baseUrl, String model) {
        prefs.edit()
                .putString(KEY_API_KEY, apiKey.trim())
                .putString(KEY_BASE_URL, baseUrl.trim().isEmpty() ? "https://api.openai.com/v1" : baseUrl.trim())
                .putString(KEY_MODEL, model.trim().isEmpty() ? "gpt-4o-mini" : model.trim())
                .apply();
    }
}
