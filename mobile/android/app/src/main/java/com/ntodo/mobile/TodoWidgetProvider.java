package com.ntodo.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import java.util.List;

public class TodoWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        updateAll(context);
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TodoWidgetProvider.class));
        TodoStore store = new TodoStore(context);
        List<Todo> active = store.activeTodos();
        StringBuilder text = new StringBuilder();
        int count = Math.min(active.size(), 6);
        for (int i = 0; i < count; i++) {
            Todo todo = active.get(i);
            text.append("• ").append(todo.title);
            if (!todo.dueDate.isEmpty()) text.append("  ").append(todo.dueDate);
            if (i < count - 1) text.append("\n");
        }
        if (text.length() == 0) text.append("没有待办");

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_todo);
            views.setTextViewText(R.id.widgetTitle, "Ntodo · 剩余 " + active.size());
            views.setTextViewText(R.id.widgetTasks, text.toString());
            Intent intent = new Intent(context, MainActivity.class);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    0,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widgetRoot, pendingIntent);
            manager.updateAppWidget(id, views);
        }
    }
}
