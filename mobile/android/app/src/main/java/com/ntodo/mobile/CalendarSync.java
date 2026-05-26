package com.ntodo.mobile;

import android.Manifest;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

public class CalendarSync {
    public static boolean hasPermission(Context context) {
        return context.checkSelfPermission(Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED
                && context.checkSelfPermission(Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED;
    }

    public static long upsertEvent(Context context, Todo todo) throws Exception {
        if (!hasPermission(context)) throw new SecurityException("缺少日历权限");
        long calendarId = firstCalendarId(context);
        if (calendarId < 0) throw new IllegalStateException("没有找到可写日历");

        long start = startMillis(todo.dueDate);
        long end = start + 60L * 60L * 1000L;
        ContentValues values = new ContentValues();
        values.put(CalendarContract.Events.CALENDAR_ID, calendarId);
        values.put(CalendarContract.Events.TITLE, todo.title);
        values.put(CalendarContract.Events.DESCRIPTION, "来自 Ntodo");
        values.put(CalendarContract.Events.DTSTART, start);
        values.put(CalendarContract.Events.DTEND, end);
        values.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());

        if (todo.calendarEventId > 0) {
            Uri uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, todo.calendarEventId);
            context.getContentResolver().update(uri, values, null, null);
            return todo.calendarEventId;
        }

        Uri uri = context.getContentResolver().insert(CalendarContract.Events.CONTENT_URI, values);
        if (uri == null) throw new IllegalStateException("创建日程失败");
        return ContentUris.parseId(uri);
    }

    public static void deleteEvent(Context context, Todo todo) {
        if (!hasPermission(context) || todo.calendarEventId <= 0) return;
        Uri uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, todo.calendarEventId);
        context.getContentResolver().delete(uri, null, null);
    }

    private static long firstCalendarId(Context context) {
        String[] projection = new String[] {
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL
        };
        try (Cursor cursor = context.getContentResolver().query(
                CalendarContract.Calendars.CONTENT_URI,
                projection,
                null,
                null,
                null)) {
            if (cursor == null) return -1L;
            while (cursor.moveToNext()) {
                int access = cursor.getInt(1);
                if (access >= CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR) {
                    return cursor.getLong(0);
                }
            }
        }
        return -1L;
    }

    private static long startMillis(String dueDate) {
        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        if (dueDate != null && dueDate.matches("\\d{4}-\\d{2}-\\d{2}")) {
            try {
                calendar.setTime(new SimpleDateFormat("yyyy-MM-dd", Locale.CHINA).parse(dueDate));
                calendar.set(Calendar.HOUR_OF_DAY, 9);
                calendar.set(Calendar.MINUTE, 0);
                return calendar.getTimeInMillis();
            } catch (Exception ignored) {
            }
        }
        calendar.add(Calendar.HOUR_OF_DAY, 1);
        return calendar.getTimeInMillis();
    }
}
