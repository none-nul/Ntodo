package com.ntodo.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.LayoutAnimationController;
import android.view.animation.TranslateAnimation;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int BG = Color.rgb(246, 247, 249);
    private static final int PAPER = Color.WHITE;
    private static final int INK = Color.rgb(31, 34, 38);
    private static final int MUTED = Color.rgb(142, 144, 148);
    private static final int GOLD = Color.rgb(223, 181, 52);
    private static final int GREEN = Color.rgb(50, 183, 89);
    private static final int BLUE = Color.rgb(71, 160, 216);
    private static final int RED = Color.rgb(222, 78, 72);
    private static final int FILTER_ACTIVE = 0;
    private static final int FILTER_COMPLETED = 1;
    private static final int FILTER_HIGH = 2;
    private static final int FILTER_ALL = 3;

    private TodoStore store;
    private LinearLayout list;
    private LinearLayout inputPanel;
    private EditText taskInput;
    private LinearLayout searchBar;
    private EditText searchInput;
    private TextView inputModeTitle;
    private TextView priorityPickerText;
    private TextView datePickerText;
    private TextView titleText;
    private TextView countText;
    private boolean aiMode = false;
    private int draftPriority = 2;
    private String draftDueDate = "";
    private int currentFilter = FILTER_ACTIVE;
    private String searchQuery = "";

    private FrameLayout rootFrame;
    private LinearLayout sidePanel;
    private FrameLayout mainContainer;
    private FrameLayout overlayLayer;
    private View overlayContent;
    private View bottomDockView;
    private View openedSwipeCard;
    private View openedSwipeActions;
    private float sidePanelWidth;
    private boolean isSidePanelOpen = false;
    private String lastSwipedId = "";
    private int leftSwipeCount = 0;
    private int keyboardHeight = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        window.setStatusBarColor(BG);
        window.setNavigationBarColor(BG);
        store = new TodoStore(this);
        requestCalendarPermissionIfNeeded();
        buildUi();
        renderTodos();
    }

    private void buildUi() {
        sidePanelWidth = dp(240);
        rootFrame = new FrameLayout(this);
        rootFrame.setBackgroundColor(BG);

        sidePanel = createSidePanel();
        rootFrame.addView(sidePanel, new FrameLayout.LayoutParams((int) sidePanelWidth, FrameLayout.LayoutParams.MATCH_PARENT));

        mainContainer = new FrameLayout(this);
        mainContainer.setBackgroundColor(BG);
        mainContainer.setOnClickListener(v -> closeTransientMenus());
        rootFrame.addView(mainContainer, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        LinearLayout contentRoot = new LinearLayout(this);
        contentRoot.setOrientation(LinearLayout.VERTICAL);
        contentRoot.setPadding(dp(20), statusBarHeight() + dp(10), dp(20), dp(92));
        contentRoot.setOnTouchListener((v, event) -> closeMenusOnOutsideDown(event));
        mainContainer.addView(contentRoot);

        contentRoot.addView(header());
        inputPanel = createInputPanel();
        inputPanel.setVisibility(View.GONE);
        contentRoot.addView(inputPanel);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setOnTouchListener((v, event) -> closeMenusOnOutsideDown(event));
        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(0, dp(14), 0, dp(22));
        list.setOnClickListener(v -> closeTransientMenus());
        scroll.addView(list);
        contentRoot.addView(scroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1));

        bottomDockView = bottomDock();
        mainContainer.addView(bottomDockView, dockParams());

        overlayLayer = new FrameLayout(this);
        overlayLayer.setBackgroundColor(Color.argb(100, 0, 0, 0));
        overlayLayer.setVisibility(View.GONE);
        overlayLayer.setOnClickListener(v -> hideOverlay());
        rootFrame.addView(overlayLayer, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(rootFrame);
        setupKeyboardHandling();
        setupSwipeReveal();
    }

    private LinearLayout createSidePanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(24), statusBarHeight() + dp(40), dp(24), 0);
        panel.setBackgroundColor(Color.rgb(238, 240, 244));

        TextView brand = text("Ntodo", 24, true, INK);
        brand.setPadding(0, 0, 0, dp(32));
        panel.addView(brand);

        String[] labels = {"\u672a\u5b8c\u6210", "\u5df2\u5b8c\u6210", "\u9ad8\u4f18\u5148\u7ea7", "\u5168\u90e8"};
        int[] icons = {R.drawable.ic_done, R.drawable.ic_done, R.drawable.ic_star, R.drawable.ic_menu};

        for (int i = 0; i < labels.length; i++) {
            final int index = i;
            LinearLayout item = row();
            item.setPadding(dp(12), dp(16), dp(12), dp(16));
            item.setBackground(round(i == currentFilter ? Color.WHITE : Color.TRANSPARENT, 12));
            item.setOnClickListener(v -> {
                currentFilter = index;
                closeSidePanel();
                renderTodos();
                updateSidePanelSelection();
            });

            ImageView icon = new ImageView(this);
            icon.setImageResource(icons[i]);
            icon.setColorFilter(i == currentFilter ? GOLD : MUTED);
            item.addView(icon, new LinearLayout.LayoutParams(dp(22), dp(22)));
            item.addView(space(dp(16)));
            item.addView(text(labels[i], 17, i == currentFilter, i == currentFilter ? INK : MUTED));

            panel.addView(item);
            panel.addView(space(dp(8)));
        }

        return panel;
    }

    private void updateSidePanelSelection() {
        for (int i = 0; i < sidePanel.getChildCount(); i++) {
            View child = sidePanel.getChildAt(i);
            if (child instanceof LinearLayout) {
                int index = (i - 1) / 2; // Offset by brand and spaces
                if (index >= 0 && index < 4) {
                    child.setBackground(round(index == currentFilter ? Color.WHITE : Color.TRANSPARENT, 12));
                    LinearLayout item = (LinearLayout) child;
                    ImageView icon = (ImageView) item.getChildAt(0);
                    TextView label = (TextView) item.getChildAt(2);
                    icon.setColorFilter(index == currentFilter ? GOLD : MUTED);
                    label.setTextColor(index == currentFilter ? INK : MUTED);
                    label.setTypeface(Typeface.DEFAULT, index == currentFilter ? Typeface.BOLD : Typeface.NORMAL);
                }
            }
        }
    }

    private void setupSwipeReveal() {
        final float[] downX = new float[1];
        mainContainer.setOnTouchListener((v, event) -> {
            if (isSidePanelOpen) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    closeSidePanel();
                    closeOpenSwipeMenu();
                    return true;
                }
            }
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                downX[0] = event.getRawX();
                return true;
            }
            if (event.getAction() == MotionEvent.ACTION_UP) {
                float dx = event.getRawX() - downX[0];
                if (dx > dp(50) && !isSidePanelOpen) {
                    openSidePanel();
                    return true;
                } else if (dx < -dp(50) && isSidePanelOpen) {
                    closeSidePanel();
                    return true;
                }
                if (Math.abs(dx) < dp(12)) closeTransientMenus();
                return true;
            }
            return false;
        });
    }

    private void openSidePanel() {
        if (isSidePanelOpen) return;
        isSidePanelOpen = true;
        mainContainer.animate().translationX(sidePanelWidth).setDuration(300).setInterpolator(new AccelerateDecelerateInterpolator()).start();
        sidePanel.setAlpha(0);
        sidePanel.animate().alpha(1).setDuration(300).start();
    }

    private void closeSidePanel() {
        if (!isSidePanelOpen) return;
        isSidePanelOpen = false;
        mainContainer.animate().translationX(0).setDuration(300).setInterpolator(new AccelerateDecelerateInterpolator()).start();
    }

    private void closeTransientMenus() {
        closeOpenSwipeMenu();
        if (isSidePanelOpen) closeSidePanel();
    }

    private void closeOpenSwipeMenu() {
        if (openedSwipeCard == null) return;
        openedSwipeCard.animate().translationX(0).setDuration(180).start();
        if (openedSwipeActions != null) openedSwipeActions.setVisibility(View.VISIBLE);
        openedSwipeCard = null;
        openedSwipeActions = null;
    }

    private boolean closeMenusOnOutsideDown(MotionEvent event) {
        if (event.getAction() != MotionEvent.ACTION_DOWN) return false;
        if (openedSwipeCard == null && !isSidePanelOpen) return false;
        closeTransientMenus();
        return true;
    }

    private void showOverlay(View content) {
        overlayLayer.removeAllViews();
        overlayContent = content;
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        params.bottomMargin = keyboardHeight > 0 ? keyboardHeight + dp(12) : 0;
        content.setOnClickListener(v -> {}); // Prevent clicks from closing overlay
        overlayLayer.addView(content, params);

        overlayLayer.setVisibility(View.VISIBLE);
        overlayLayer.setAlpha(0);
        overlayLayer.animate().alpha(1).setDuration(200).start();

        content.setTranslationY(dp(400));
        content.animate().translationY(0).setDuration(300).setInterpolator(new AccelerateDecelerateInterpolator()).start();
    }

    private void hideOverlay() {
        if (overlayLayer.getVisibility() != View.VISIBLE) return;
        overlayLayer.animate().alpha(0).setDuration(200).withEndAction(() -> overlayLayer.setVisibility(View.GONE)).start();
        if (overlayContent != null) {
            overlayContent.animate().translationY(dp(400)).setDuration(300).start();
        }
    }

    private void setupKeyboardHandling() {
        rootFrame.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
            @Override
            public void onGlobalLayout() {
                Rect visibleFrame = new Rect();
                rootFrame.getWindowVisibleDisplayFrame(visibleFrame);
                int screenHeight = getResources().getDisplayMetrics().heightPixels;
                int detectedHeight = Math.max(0, screenHeight - visibleFrame.bottom);
                boolean keyboardVisible = detectedHeight > screenHeight * 0.15f;
                keyboardHeight = keyboardVisible ? detectedHeight : 0;

                if (bottomDockView != null) {
                    bottomDockView.setVisibility(keyboardVisible ? View.GONE : View.VISIBLE);
                }
                if (inputPanel != null && inputPanel.getVisibility() == View.VISIBLE) {
                    inputPanel.setTranslationY(keyboardVisible ? -dp(8) : 0);
                }
                updateOverlayKeyboardMargin();
            }
        });
    }

    private void updateOverlayKeyboardMargin() {
        if (overlayContent == null) return;
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) overlayContent.getLayoutParams();
        int bottomMargin = keyboardHeight > 0 ? keyboardHeight + dp(12) : 0;
        if (params.bottomMargin == bottomMargin) return;
        params.bottomMargin = bottomMargin;
        overlayContent.setLayoutParams(params);
    }

    private View header() {
        LinearLayout wrap = new LinearLayout(this);
        wrap.setOrientation(LinearLayout.VERTICAL);

        LinearLayout tools = row();
        tools.setPadding(0, 0, 0, dp(2));
        ImageButton menu = iconButton(R.drawable.ic_menu, INK, Color.TRANSPARENT, 44);
        ImageButton search = iconButton(R.drawable.ic_search, INK, Color.TRANSPARENT, 44);
        ImageButton settings = iconButton(R.drawable.ic_more, INK, Color.TRANSPARENT, 44);
        menu.setOnClickListener(v -> openSidePanel());
        search.setOnClickListener(v -> toggleSearchBar());
        settings.setOnClickListener(v -> showAiSettings());
        tools.addView(menu, new LinearLayout.LayoutParams(dp(44), dp(44)));
        tools.addView(new SpaceView(this), new LinearLayout.LayoutParams(0, 1, 1));
        tools.addView(search, new LinearLayout.LayoutParams(dp(44), dp(44)));
        tools.addView(settings, new LinearLayout.LayoutParams(dp(44), dp(44)));
        wrap.addView(tools);

        titleText = text("\u672a\u5b8c\u6210", 32, true, INK);
        titleText.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        wrap.addView(titleText);

        countText = text("\u5269\u4f59 0 \u9879", 15, true, MUTED);
        wrap.addView(countText);
        searchBar = createSearchBar();
        searchBar.setVisibility(View.GONE);
        wrap.addView(searchBar);
        return wrap;
    }

    private LinearLayout createSearchBar() {
        LinearLayout bar = row();
        bar.setPadding(dp(14), dp(6), dp(8), dp(6));
        bar.setBackground(round(Color.WHITE, 28));
        bar.setElevation(dp(3));

        ImageButton searchIcon = iconButton(R.drawable.ic_search, INK, Color.TRANSPARENT, 40);
        searchIcon.setEnabled(false);
        bar.addView(searchIcon, new LinearLayout.LayoutParams(dp(40), dp(40)));

        searchInput = new EditText(this);
        searchInput.setHint("\u641c\u7d22\u5f85\u529e");
        searchInput.setTextSize(16);
        searchInput.setSingleLine(true);
        searchInput.setInputType(InputType.TYPE_CLASS_TEXT);
        searchInput.setBackgroundColor(Color.TRANSPARENT);
        searchInput.setPadding(dp(4), 0, dp(4), 0);
        searchInput.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                searchQuery = s.toString();
                renderTodos();
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });
        bar.addView(searchInput, new LinearLayout.LayoutParams(0, dp(44), 1));

        ImageButton close = iconButton(R.drawable.ic_close, INK, Color.TRANSPARENT, 40);
        close.setOnClickListener(v -> {
            searchInput.setText("");
            searchQuery = "";
            searchBar.setVisibility(View.GONE);
            renderTodos();
        });
        bar.addView(close, new LinearLayout.LayoutParams(dp(40), dp(40)));

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(56));
        params.setMargins(0, dp(14), 0, dp(4));
        bar.setLayoutParams(params);
        return bar;
    }

    private LinearLayout createInputPanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(14), dp(14), dp(14), dp(14));
        panel.setBackground(round(PAPER, 22));
        panel.setElevation(dp(2));

        inputModeTitle = text("\u624b\u52a8\u6dfb\u52a0", 18, true, INK);
        panel.addView(inputModeTitle);

        taskInput = new EditText(this);
        taskInput.setHint("\u6dfb\u52a0\u73b0\u5728\u8981\u505a\u7684\u4e8b");
        taskInput.setTextSize(17);
        taskInput.setSingleLine(false);
        taskInput.setMinLines(1);
        taskInput.setMaxLines(3);
        taskInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        taskInput.setBackgroundColor(Color.TRANSPARENT);
        taskInput.setPadding(0, dp(12), 0, dp(10));
        panel.addView(taskInput, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout options = row();
        options.setPadding(0, 0, 0, dp(12));
        priorityPickerText = optionChip("\u4e2d");
        datePickerText = optionChip("\u65e0\u622a\u6b62\u65e5\u671f");
        priorityPickerText.setOnClickListener(v -> cycleDraftPriority());
        datePickerText.setOnClickListener(v -> showDraftDatePicker());
        options.addView(datePickerText, new LinearLayout.LayoutParams(0, dp(38), 1));
        options.addView(space(dp(10)));
        options.addView(priorityPickerText, new LinearLayout.LayoutParams(dp(70), dp(38)));
        panel.addView(options);

        Button add = primaryButton("\u6dfb\u52a0");
        add.setOnClickListener(v -> addFromInput());
        panel.addView(add, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)));

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(18), 0, dp(12));
        panel.setLayoutParams(params);
        return panel;
    }

    private View bottomDock() {
        LinearLayout dock = row();
        dock.setGravity(Gravity.CENTER);
        dock.setPadding(dp(14), dp(10), dp(14), dp(10));
        dock.setBackground(round(Color.WHITE, 34));
        dock.setElevation(dp(12));

        ImageButton add = iconButton(R.drawable.ic_add, GOLD, Color.WHITE, 58);
        add.setBackground(strokeRound(Color.WHITE, GOLD, 28, 2));
        add.setOnClickListener(v -> showAddPanel(false));
        TextView ai = circle("AI", Color.rgb(250, 240, 211), GOLD, 20);
        ai.setOnClickListener(v -> showAddPanel(true));
        ImageButton deadline = iconButton(R.drawable.ic_calendar, Color.WHITE, GOLD, 58);
        deadline.setOnClickListener(v -> syncDatedTodosToDeadline());

        dock.addView(add, new LinearLayout.LayoutParams(dp(58), dp(58)));
        dock.addView(space(dp(18)));
        dock.addView(ai, new LinearLayout.LayoutParams(dp(66), dp(66)));
        dock.addView(space(dp(18)));
        dock.addView(deadline, new LinearLayout.LayoutParams(dp(58), dp(58)));
        return dock;
    }

    private FrameLayout.LayoutParams dockParams() {
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        params.setMargins(0, 0, 0, dp(22));
        return params;
    }

    private void showAddPanel(boolean useAi) {
        if (inputPanel.getVisibility() == View.VISIBLE && aiMode == useAi) {
            inputPanel.animate().alpha(0).translationY(-dp(20)).setDuration(200).withEndAction(() -> inputPanel.setVisibility(View.GONE)).start();
            return;
        }
        inputPanel.setVisibility(View.VISIBLE);
        inputPanel.setAlpha(0);
        inputPanel.setTranslationY(-dp(20));
        inputPanel.animate().alpha(1).translationY(0).setDuration(300).setInterpolator(new AccelerateDecelerateInterpolator()).start();
        setMode(useAi);
        taskInput.requestFocus();
    }

    private void setMode(boolean useAi) {
        aiMode = useAi;
        inputModeTitle.setText(useAi ? "AI \u6dfb\u52a0" : "\u624b\u52a8\u6dfb\u52a0");
        taskInput.setHint(useAi
                ? "\u4f8b\u5982\uff1a\u660e\u5929\u5fc5\u987b\u63d0\u4ea4\u82f1\u8bed\u4f5c\u6587"
                : "\u6dfb\u52a0\u73b0\u5728\u8981\u505a\u7684\u4e8b");
    }

    private void addFromInput() {
        if (inputPanel.getVisibility() != View.VISIBLE) {
            showAddPanel(false);
            return;
        }
        String text = taskInput.getText().toString().trim();
        if (text.isEmpty()) return;
        if (!aiMode) {
            Todo todo = new Todo();
            todo.title = text;
            todo.priority = draftPriority;
            todo.dueDate = draftDueDate;
            List<Todo> todos = store.readTodos();
            todos.add(todo);
            store.writeTodos(todos);
            taskInput.setText("");
            resetDraftOptions();
            inputPanel.setVisibility(View.GONE);
            afterTodosChanged();
            return;
        }

        toast("\u6b63\u5728\u89e3\u6790");
        new Thread(() -> {
            try {
                List<Todo> parsed = AiTaskParser.parse(text, store);
                runOnUiThread(() -> {
                    if (parsed.isEmpty()) {
                        toast("AI \u6ca1\u6709\u8bc6\u522b\u5230\u4efb\u52a1");
                        return;
                    }
                    List<Todo> todos = store.readTodos();
                    todos.addAll(parsed);
                    store.writeTodos(todos);
                    taskInput.setText("");
                    resetDraftOptions();
                    inputPanel.setVisibility(View.GONE);
                    afterTodosChanged();
                });
            } catch (Exception error) {
                runOnUiThread(() -> toast(error.getMessage()));
            }
        }).start();
    }

    private void renderTodos() {
        list.removeAllViews();
        List<Todo> todos = filteredTodos();
        int activeCount = 0;
        for (Todo todo : store.readTodos()) {
            if (!todo.done) activeCount++;
        }
        updateCount(activeCount);

        for (Todo todo : todos) {
            list.addView(todoRow(todo));
        }

        LayoutAnimationController controller = new LayoutAnimationController(
                new AlphaAnimation(0, 1), 0.15f);
        controller.setOrder(LayoutAnimationController.ORDER_NORMAL);
        list.setLayoutAnimation(controller);

        if (todos.isEmpty()) {
            TextView empty = text("\u6ca1\u6709\u5f85\u529e", 17, false, MUTED);
            empty.setGravity(Gravity.CENTER);
            list.addView(empty, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(180)));
        }
    }

    private List<Todo> filteredTodos() {
        List<Todo> result = new ArrayList<>();
        String query = searchQuery.trim().toLowerCase();
        for (Todo todo : store.readTodos()) {
            if (currentFilter == FILTER_ACTIVE && todo.done) continue;
            if (currentFilter == FILTER_COMPLETED && !todo.done) continue;
            if (currentFilter == FILTER_HIGH && (todo.done || todo.priority < 3)) continue;
            if (!query.isEmpty() && !todo.title.toLowerCase().contains(query)) continue;
            result.add(todo);
        }
        return result;
    }

    private void updateCount(int count) {
        if (countText != null) countText.setText("\u5269\u4f59 " + count + " \u9879");
        if (titleText != null) titleText.setText(filterTitle());
    }

    private String filterTitle() {
        if (currentFilter == FILTER_COMPLETED) return "\u5df2\u5b8c\u6210";
        if (currentFilter == FILTER_HIGH) return "\u9ad8\u4f18\u5148\u7ea7";
        if (currentFilter == FILTER_ALL) return "\u5168\u90e8\u5f85\u529e";
        return "\u672a\u5b8c\u6210";
    }

    private View todoRow(Todo todo) {
        FrameLayout cardShell = new FrameLayout(this);
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(36));
        card.setBackground(round(PAPER, 26));
        card.setElevation(dp(2));

        LinearLayout titleRow = row();
        TextView bar = new TextView(this);
        bar.setBackground(round(priorityColor(todo.priority), 3));
        titleRow.addView(bar, new LinearLayout.LayoutParams(dp(5), dp(25)));
        titleRow.addView(space(dp(12)));
        TextView title = text(todo.title, 20, true, INK);
        title.setMaxLines(2);
        if (todo.done) {
            title.setAlpha(0.45f);
            title.setPaintFlags(title.getPaintFlags() | Paint.STRIKE_THRU_TEXT_FLAG);
        }
        titleRow.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        card.addView(titleRow);

        String meta = todo.dueDate.isEmpty() ? "\u65e0\u622a\u6b62\u65e5\u671f" : todo.dueDate;
        if (todo.calendarEventId > 0) meta += " \u00b7 \u5df2\u540c\u6b65\u622a\u6b62\u65e5\u671f";
        if (todo.pinned) meta += " \u00b7 \u5df2\u7f6e\u9876";
        TextView detail = text("\u2611 " + meta, 14, true, MUTED);
        LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        detailParams.setMargins(dp(17), dp(10), 0, 0);
        card.addView(detail, detailParams);

        LinearLayout footer = row();
        footer.setPadding(dp(17), dp(10), 0, 0);
        TextView priority = text(priorityLabel(todo.priority), 13, true, MUTED);
        TextView state = text(todo.done ? "\u5df2\u5b8c\u6210" : "\u672a\u5b8c\u6210", 13, true, MUTED);
        footer.addView(priority, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        footer.addView(state);
        card.addView(footer);
        cardShell.addView(card, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));
        addDueWatermark(cardShell, todo);

        LinearLayout actions = row();
        actions.setGravity(Gravity.CENTER);
        actions.setPadding(dp(18), 0, 0, 0);
        actions.addView(action(R.drawable.ic_done, GREEN, () -> {
            todo.done = !todo.done;
            saveTodo(todo);
        }));
        actions.addView(space(dp(14)));
        actions.addView(action(R.drawable.ic_pin, BLUE, () -> togglePinned(todo)));
        actions.addView(space(dp(14)));
        actions.addView(action(R.drawable.ic_edit, GOLD, () -> editTodo(todo)));
        actions.addView(space(dp(14)));
        actions.addView(action(R.drawable.ic_delete, RED, () -> deleteTodo(todo)));
        FrameLayout swipeFrame = new FrameLayout(this);
        swipeFrame.addView(actions, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
                Gravity.END | Gravity.CENTER_VERTICAL));
        swipeFrame.addView(cardShell, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));
        bindSwipe(cardShell, actions, todo);

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dp(16));
        swipeFrame.setLayoutParams(params);
        return swipeFrame;
    }

    private ImageButton action(int iconRes, int color, Runnable runnable) {
        ImageButton view = new ImageButton(this);
        view.setImageResource(iconRes);
        view.setColorFilter(color);
        view.setScaleType(ImageView.ScaleType.CENTER);
        view.setBackground(actionBg(color));
        view.setOnClickListener(v -> runnable.run());
        view.setElevation(dp(2));
        view.setPadding(dp(10), dp(10), dp(10), dp(10));
        view.setLayoutParams(new LinearLayout.LayoutParams(dp(42), dp(42)));
        return view;
    }

    private void addDueWatermark(FrameLayout shell, Todo todo) {
        DueInfo due = dueInfo(todo.dueDate);
        if (due == null) return;

        LinearLayout mark = new LinearLayout(this);
        mark.setOrientation(LinearLayout.VERTICAL);
        mark.setGravity(Gravity.END);
        mark.setAlpha(0.34f);
        mark.setTranslationZ(dp(8));

        TextView value = text(due.value, 38, true, due.overdue ? RED : INK);
        value.setGravity(Gravity.END);
        value.setIncludeFontPadding(false);
        TextView caption = text(due.caption, 12, true, due.overdue ? RED : MUTED);
        caption.setGravity(Gravity.END);
        caption.setIncludeFontPadding(false);
        mark.addView(value);
        mark.addView(caption);

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                dp(96),
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.END | Gravity.BOTTOM);
        params.setMargins(0, 0, dp(20), dp(18));
        shell.addView(mark, params);
        mark.bringToFront();
    }

    private DueInfo dueInfo(String dueDate) {
        if (dueDate == null || !dueDate.matches("\\d{4}-\\d{2}-\\d{2}")) return null;
        try {
            String[] parts = dueDate.split("-");
            Calendar due = Calendar.getInstance();
            due.set(Calendar.YEAR, Integer.parseInt(parts[0]));
            due.set(Calendar.MONTH, Integer.parseInt(parts[1]) - 1);
            due.set(Calendar.DAY_OF_MONTH, Integer.parseInt(parts[2]));
            startOfDay(due);

            Calendar today = Calendar.getInstance();
            startOfDay(today);
            long diff = (due.getTimeInMillis() - today.getTimeInMillis()) / 86400000L;
            if (diff == 0) return new DueInfo("\u4eca\u5929", dueDate, false);
            if (diff > 0) return new DueInfo(diff + "\u5929", "\u5269\u4f59", false);
            return new DueInfo(Math.abs(diff) + "\u5929", "\u5df2\u8d85", true);
        } catch (Exception ignored) {
            return null;
        }
    }

    private void startOfDay(Calendar calendar) {
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
    }

    private static class DueInfo {
        final String value;
        final String caption;
        final boolean overdue;

        DueInfo(String value, String caption, boolean overdue) {
            this.value = value;
            this.caption = caption;
            this.overdue = overdue;
        }
    }

    private void bindSwipe(View card, View actions, Todo todo) {
        final float[] downX = new float[1];
        final float[] downY = new float[1];
        final boolean[] open = new boolean[1];
        card.setOnTouchListener((view, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                if (openedSwipeCard != null && openedSwipeCard != view) {
                    closeOpenSwipeMenu();
                    return true;
                }
                downX[0] = event.getRawX();
                downY[0] = event.getRawY();
                return true;
            }
            if (event.getAction() == MotionEvent.ACTION_UP) {
                float dx = event.getRawX() - downX[0];
                float dy = Math.abs(event.getRawY() - downY[0]);
                if (Math.abs(dx) > dp(70) && Math.abs(dx) > dy) {
                    if (dx < 0) {
                        // 逻辑：连续左滑两次删除
                        if (todo.id.equals(lastSwipedId)) {
                            leftSwipeCount++;
                        } else {
                            lastSwipedId = todo.id;
                            leftSwipeCount = 1;
                        }

                        if (leftSwipeCount >= 2) {
                            // 触发垃圾桶打开动画并删除
                            ImageButton deleteBtn = (ImageButton) ((LinearLayout)actions).getChildAt(6);
                            deleteBtn.setImageResource(R.drawable.ic_delete_open);
                            deleteBtn.animate().scaleX(1.3f).scaleY(1.3f).setDuration(150).withEndAction(() -> {
                                view.animate().translationX(-view.getWidth()).alpha(0).setDuration(300).withEndAction(() -> {
                                    deleteTodo(todo);
                                    lastSwipedId = "";
                                    leftSwipeCount = 0;
                                }).start();
                            }).start();
                        } else {
                            if (openedSwipeCard != null && openedSwipeCard != view) closeOpenSwipeMenu();
                            open[0] = openedSwipeCard != view;
                            openedSwipeCard = open[0] ? view : null;
                            openedSwipeActions = open[0] ? actions : null;
                            actions.setVisibility(View.VISIBLE);
                            view.animate().translationX(open[0] ? -dp(226) : 0).setDuration(180).start();
                        }
                    } else if (open[0] || view.getTranslationX() < 0) {
                        open[0] = false;
                        closeOpenSwipeMenu();
                    } else if (currentFilter == FILTER_COMPLETED && todo.done) {
                        deleteTodo(todo);
                    } else if (!todo.done) {
                        openedSwipeCard = null;
                        openedSwipeActions = null;
                        actions.setVisibility(View.INVISIBLE);
                        view.animate().translationX(view.getWidth()).alpha(0).setDuration(280).withEndAction(() -> {
                            todo.done = true;
                            saveTodo(todo);
                        }).start();
                    }
                    return true;
                }
                if (openedSwipeCard == view) {
                    open[0] = false;
                    closeOpenSwipeMenu();
                    return true;
                }
                return false;
            }
            return false;
        });
    }

    private TextView optionChip(String label) {
        TextView chip = text(label, 14, true, MUTED);
        chip.setGravity(Gravity.CENTER);
        chip.setBackground(strokeRound(Color.WHITE, Color.rgb(225, 227, 230), 12, 1));
        return chip;
    }

    private void resetDraftOptions() {
        draftPriority = 2;
        draftDueDate = "";
        if (priorityPickerText != null) priorityPickerText.setText("\u4e2d");
        if (datePickerText != null) datePickerText.setText("\u65e0\u622a\u6b62\u65e5\u671f");
    }

    private void cycleDraftPriority() {
        draftPriority = draftPriority >= 3 ? 1 : draftPriority + 1;
        priorityPickerText.setText(shortPriorityLabel(draftPriority));
        priorityPickerText.setTextColor(priorityColor(draftPriority));
    }

    private void showDraftDatePicker() {
        showDatePicker(draftDueDate, value -> {
            draftDueDate = value;
            datePickerText.setText(value.isEmpty() ? "\u65e0\u622a\u6b62\u65e5\u671f" : value);
        });
    }

    private void showDatePicker(String initialDate, DatePicked callback) {
        Calendar calendar = Calendar.getInstance();
        if (initialDate != null && initialDate.matches("\\d{4}-\\d{2}-\\d{2}")) {
            try {
                String[] parts = initialDate.split("-");
                calendar.set(Calendar.YEAR, Integer.parseInt(parts[0]));
                calendar.set(Calendar.MONTH, Integer.parseInt(parts[1]) - 1);
                calendar.set(Calendar.DAY_OF_MONTH, Integer.parseInt(parts[2]));
            } catch (Exception ignored) {
            }
        }
        DatePickerDialog dialog = new DatePickerDialog(
                this,
                (view, year, month, dayOfMonth) -> callback.onDatePicked(String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, dayOfMonth)),
                calendar.get(Calendar.YEAR),
                calendar.get(Calendar.MONTH),
                calendar.get(Calendar.DAY_OF_MONTH));
        dialog.setButton(DatePickerDialog.BUTTON_NEUTRAL, "\u6e05\u9664", (d, which) -> callback.onDatePicked(""));
        dialog.show();
    }

    private interface DatePicked {
        void onDatePicked(String value);
    }

    private void togglePinned(Todo todo) {
        todo.pinned = !todo.pinned;
        saveTodo(todo);
        toast(todo.pinned ? "\u5df2\u7f6e\u9876" : "\u5df2\u53d6\u6d88\u7f6e\u9876");
    }

    private void editTodo(Todo todo) {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(24), dp(24), dp(24), dp(32));
        panel.setBackground(round(Color.WHITE, 32));

        panel.addView(text("\u7f16\u8f91\u5f85\u529e", 20, true, INK));
        panel.addView(space(dp(16)));

        EditText title = edit("\u4efb\u52a1\u540d", todo.title);
        title.setBackground(round(BG, 12));
        title.setPadding(dp(16), dp(12), dp(16), dp(12));
        panel.addView(title);
        panel.addView(space(dp(12)));

        TextView priority = optionChip(priorityLabel(todo.priority));
        priority.setOnClickListener(v -> {
            todo.priority = todo.priority >= 3 ? 1 : todo.priority + 1;
            priority.setText(priorityLabel(todo.priority));
        });
        panel.addView(priority, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(42)));
        panel.addView(space(dp(12)));

        TextView date = optionChip(todo.dueDate == null || todo.dueDate.isEmpty() ? "\u65e0\u622a\u6b62\u65e5\u671f" : todo.dueDate);
        date.setOnClickListener(v -> showDatePicker(todo.dueDate, value -> {
            todo.dueDate = value;
            date.setText(value.isEmpty() ? "\u65e0\u622a\u6b62\u65e5\u671f" : value);
        }));
        panel.addView(date, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(42)));
        panel.addView(space(dp(18)));

        Button save = primaryButton("\u4fdd\u5b58");
        save.setOnClickListener(v -> {
            String value = title.getText().toString().trim();
            if (!value.isEmpty()) todo.title = value;
            if (todo.dueDate != null && !todo.dueDate.isEmpty() && CalendarSync.hasPermission(this)) {
                try {
                    todo.calendarEventId = CalendarSync.upsertEvent(this, todo);
                } catch (Exception error) {
                    toast(error.getMessage());
                }
            }
            saveTodo(todo);
            hideOverlay();
        });
        panel.addView(save, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52)));
        showOverlay(panel);
    }

    private void saveTodo(Todo updated) {
        List<Todo> todos = store.readTodos();
        for (int i = 0; i < todos.size(); i++) {
            if (todos.get(i).id.equals(updated.id)) {
                todos.set(i, updated);
                break;
            }
        }
        store.writeTodos(todos);
        afterTodosChanged();
    }

    private void deleteTodo(Todo todo) {
        CalendarSync.deleteEvent(this, todo);
        List<Todo> todos = store.readTodos();
        todos.removeIf(item -> item.id.equals(todo.id));
        store.writeTodos(todos);
        afterTodosChanged();
    }


    private void syncDatedTodosToDeadline() {
        if (!CalendarSync.hasPermission(this)) {
            requestCalendarPermissionIfNeeded();
            toast("\u8bf7\u5148\u5141\u8bb8\u65e5\u5386\u6743\u9650");
            return;
        }
        List<Todo> todos = store.readTodos();
        int synced = 0;
        for (Todo todo : todos) {
            if (todo.dueDate == null || todo.dueDate.isEmpty()) continue;
            try {
                todo.calendarEventId = CalendarSync.upsertEvent(this, todo);
                synced++;
            } catch (Exception error) {
                toast(error.getMessage());
                break;
            }
        }
        store.writeTodos(todos);
        afterTodosChanged();
        toast("\u5df2\u540c\u6b65 " + synced + " \u4e2a\u622a\u6b62\u65e5\u671f");
    }

    private void toggleSearchBar() {
        if (searchBar.getVisibility() == View.VISIBLE) {
            searchBar.animate().alpha(0).translationY(-dp(20)).setDuration(200).withEndAction(() -> {
                searchBar.setVisibility(View.GONE);
                searchInput.setText("");
                searchQuery = "";
                renderTodos();
            }).start();
            return;
        }
        searchBar.setVisibility(View.VISIBLE);
        searchBar.setAlpha(0);
        searchBar.setTranslationY(-dp(20));
        searchBar.animate().alpha(1).translationY(0).setDuration(300).setInterpolator(new AccelerateDecelerateInterpolator()).start();
        searchInput.requestFocus();
    }

    private void showAiSettings() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(24), dp(24), dp(24), dp(32));
        panel.setBackground(round(Color.WHITE, 32));

        panel.addView(text("AI \u8bbe\u7f6e", 20, true, INK));
        panel.addView(space(dp(16)));

        EditText apiKey = edit("API Key", store.apiKey());
        EditText baseUrl = edit("Base URL", store.baseUrl());
        EditText model = edit("Model", store.model());

        for (EditText et : new EditText[]{apiKey, baseUrl, model}) {
            et.setBackground(round(BG, 12));
            et.setPadding(dp(16), dp(12), dp(16), dp(12));
            panel.addView(et);
            panel.addView(space(dp(12)));
        }

        Button save = primaryButton("\u4fdd\u5b58");
        save.setOnClickListener(v -> {
            store.saveAiSettings(
                    apiKey.getText().toString(),
                    baseUrl.getText().toString(),
                    model.getText().toString());
            hideOverlay();
            toast("\u8bbe\u7f6e\u5df2\u4fdd\u5b58");
        });
        panel.addView(save, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52)));

        showOverlay(panel);
    }

    private void afterTodosChanged() {
        renderTodos();
        TodoWidgetProvider.updateAll(this);
    }

    private void requestCalendarPermissionIfNeeded() {
        if (!CalendarSync.hasPermission(this)) {
            requestPermissions(new String[] {
                    Manifest.permission.READ_CALENDAR,
                    Manifest.permission.WRITE_CALENDAR
            }, 10);
        }
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        return row;
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(16);
        button.setTextColor(Color.WHITE);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackground(round(Color.rgb(30, 135, 112), 14));
        return button;
    }

    private EditText edit(String hint, String value) {
        EditText edit = new EditText(this);
        edit.setHint(hint);
        edit.setText(value);
        edit.setTextSize(16);
        return edit;
    }

    private TextView text(String value, int sp, boolean bold, int color) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(sp);
        text.setTextColor(color);
        text.setIncludeFontPadding(true);
        if (bold) text.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return text;
    }

    private ImageButton iconButton(int iconRes, int iconColor, int backgroundColor, int radiusDp) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(iconRes);
        button.setColorFilter(iconColor);
        button.setScaleType(ImageView.ScaleType.CENTER);
        button.setBackground(round(backgroundColor, radiusDp));
        button.setPadding(dp(10), dp(10), dp(10), dp(10));
        return button;
    }

    private TextView circle(String label, int bg, int fg, int sp) {
        TextView view = text(label, sp, true, fg);
        view.setGravity(Gravity.CENTER);
        view.setBackground(round(bg, 999));
        return view;
    }

    private View space(int width) {
        SpaceView view = new SpaceView(this);
        view.setLayoutParams(new LinearLayout.LayoutParams(width, 1));
        return view;
    }

    private GradientDrawable round(int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private GradientDrawable strokeRound(int color, int strokeColor, int radiusDp, int strokeDp) {
        GradientDrawable drawable = round(color, radiusDp);
        drawable.setStroke(dp(strokeDp), strokeColor);
        return drawable;
    }

    private GradientDrawable actionBg(int color) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setColor(Color.WHITE);
        drawable.setStroke(dp(2), color);
        return drawable;
    }

    private int priorityColor(int priority) {
        if (priority >= 3) return RED;
        if (priority <= 1) return GREEN;
        return GOLD;
    }

    private String priorityLabel(int priority) {
        if (priority >= 3) return "\u9ad8\u4f18\u5148\u7ea7";
        if (priority <= 1) return "\u4f4e\u4f18\u5148\u7ea7";
        return "\u4e2d\u4f18\u5148\u7ea7";
    }

    private String shortPriorityLabel(int priority) {
        if (priority >= 3) return "\u9ad8";
        if (priority <= 1) return "\u4f4e";
        return "\u4e2d";
    }

    private int statusBarHeight() {
        int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void toast(String message) {
        Toast.makeText(this, message == null ? "\u64cd\u4f5c\u5931\u8d25" : message, Toast.LENGTH_LONG).show();
    }

    private static class SpaceView extends View {
        SpaceView(android.content.Context context) {
            super(context);
        }
    }
}
