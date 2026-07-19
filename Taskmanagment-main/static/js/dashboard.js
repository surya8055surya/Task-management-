/**
 * dashboard.js - task list, filters, CRUD modals, pagination, stats.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (!TokenStore.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  // ---- element refs ----
  const tableBody = document.getElementById("task-table-body");
  const emptyState = document.getElementById("task-empty");
  const alertBox = document.getElementById("task-alert");
  const paginationEl = document.getElementById("task-pagination");

  const statusFilter = document.getElementById("filter-status");
  const priorityFilter = document.getElementById("filter-priority");
  const orderingFilter = document.getElementById("filter-ordering");
  const searchInput = document.getElementById("filter-search");

  const taskModalEl = document.getElementById("task-modal");
  const taskModal = new bootstrap.Modal(taskModalEl);
  const taskForm = document.getElementById("task-form");
  const taskModalTitle = document.getElementById("task-modal-title");

  const deleteModalEl = document.getElementById("delete-modal");
  const deleteModal = new bootstrap.Modal(deleteModalEl);
  const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

  let currentPageUrl = null; // relative path + querystring for the current page of results
  let searchDebounceTimer = null;
  let taskPendingDelete = null;

  const STATUS_BADGES = {
    todo: "bg-secondary",
    in_progress: "bg-primary",
    done: "bg-success",
  };
  const PRIORITY_BADGES = {
    low: "bg-light text-dark border",
    medium: "bg-warning text-dark",
    high: "bg-danger",
  };
  const STATUS_LABELS = { todo: "To Do", in_progress: "In Progress", done: "Done" };
  const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High" };

  function showError(message) {
    alertBox.textContent = message;
    alertBox.classList.remove("d-none");
  }
  function hideError() {
    alertBox.classList.add("d-none");
  }

  function buildQuery() {
    const params = new URLSearchParams();
    if (statusFilter.value) params.set("status", statusFilter.value);
    if (priorityFilter.value) params.set("priority", priorityFilter.value);
    if (orderingFilter.value) params.set("ordering", orderingFilter.value);
    if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
    return params.toString();
  }

  async function loadStats() {
    try {
      const res = await apiFetch("/tasks/stats/");
      if (!res.ok) return;
      const data = await res.json();
      document.getElementById("stat-total").textContent = data.total;
      document.getElementById("stat-todo").textContent = data.todo;
      document.getElementById("stat-in_progress").textContent = data.in_progress;
      document.getElementById("stat-done").textContent = data.done;
    } catch (err) {
      /* stats are a nice-to-have; fail silently */
    }
  }

  async function loadTasks(pageUrl = null) {
    hideError();
    tableBody.innerHTML = `
      <tr><td colspan="5" class="text-center text-muted py-4">
        <div class="spinner-border spinner-border-sm me-2"></div> Loading tasks&hellip;
      </td></tr>`;
    emptyState.classList.add("d-none");

    const path = pageUrl || `/tasks/?${buildQuery()}`;
    currentPageUrl = path;

    try {
      const res = await apiFetch(path);
      const data = await res.json();

      if (!res.ok) {
        showError(extractErrorMessage(data));
        tableBody.innerHTML = "";
        return;
      }

      const results = data.results !== undefined ? data.results : data;
      renderTasks(results);
      renderPagination(data);
    } catch (err) {
      showError("Could not load tasks. Please try again.");
      tableBody.innerHTML = "";
    }
  }

  function renderTasks(tasks) {
    tableBody.innerHTML = "";
    if (!tasks || tasks.length === 0) {
      emptyState.classList.remove("d-none");
      return;
    }
    emptyState.classList.add("d-none");

    for (const task of tasks) {
      const tr = document.createElement("tr");

      const dueLabel = task.due_date
        ? task.due_date + (task.is_overdue ? ' <span class="badge bg-danger ms-1">Overdue</span>' : "")
        : '<span class="text-muted">—</span>';

      tr.innerHTML = `
        <td>
          <div class="fw-semibold">${escapeHtml(task.title)}</div>
          ${task.description ? `<div class="text-muted small">${escapeHtml(task.description)}</div>` : ""}
        </td>
        <td><span class="badge ${STATUS_BADGES[task.status]}">${STATUS_LABELS[task.status]}</span></td>
        <td><span class="badge ${PRIORITY_BADGES[task.priority]}">${PRIORITY_LABELS[task.priority]}</span></td>
        <td>${dueLabel}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary edit-btn" data-id="${task.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${task.id}" data-title="${escapeHtml(task.title)}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    }

    tableBody.querySelectorAll(".edit-btn").forEach((btn) =>
      btn.addEventListener("click", () => openEditModal(btn.dataset.id, tasks))
    );
    tableBody.querySelectorAll(".delete-btn").forEach((btn) =>
      btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, btn.dataset.title))
    );
  }

  function renderPagination(data) {
    paginationEl.innerHTML = "";
    if (!data.next && !data.previous) return;

    const prevLi = document.createElement("li");
    prevLi.className = `page-item ${data.previous ? "" : "disabled"}`;
    prevLi.innerHTML = `<button class="page-link">Previous</button>`;
    prevLi.querySelector("button").addEventListener("click", () => {
      if (data.previous) loadTasks(toRelative(data.previous));
    });
    paginationEl.appendChild(prevLi);

    const nextLi = document.createElement("li");
    nextLi.className = `page-item ${data.next ? "" : "disabled"}`;
    nextLi.innerHTML = `<button class="page-link">Next</button>`;
    nextLi.querySelector("button").addEventListener("click", () => {
      if (data.next) loadTasks(toRelative(data.next));
    });
    paginationEl.appendChild(nextLi);
  }

  /** DRF returns absolute next/previous URLs; strip down to path+query relative to /api. */
  function toRelative(absoluteUrl) {
    const url = new URL(absoluteUrl);
    return url.pathname.replace(/^\/api/, "") + url.search;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  // ---- Create / Edit modal ----
  document.getElementById("new-task-btn").addEventListener("click", () => openCreateModal());

  function openCreateModal() {
    taskForm.reset();
    document.getElementById("task-id").value = "";
    taskModalTitle.textContent = "New Task";
    document.getElementById("task-priority").value = "medium";
    taskModal.show();
  }

  function openEditModal(id, tasksOnPage) {
    const task = tasksOnPage.find((t) => String(t.id) === String(id));
    if (!task) return;
    document.getElementById("task-id").value = task.id;
    document.getElementById("task-title").value = task.title;
    document.getElementById("task-description").value = task.description || "";
    document.getElementById("task-status").value = task.status;
    document.getElementById("task-priority").value = task.priority;
    document.getElementById("task-due-date").value = task.due_date || "";
    taskModalTitle.textContent = "Edit Task";
    taskModal.show();
  }

  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const id = document.getElementById("task-id").value;
    const payload = {
      title: document.getElementById("task-title").value.trim(),
      description: document.getElementById("task-description").value.trim(),
      status: document.getElementById("task-status").value,
      priority: document.getElementById("task-priority").value,
      due_date: document.getElementById("task-due-date").value || null,
    };

    const isEdit = !!id;
    const path = isEdit ? `/tasks/${id}/` : "/tasks/";
    const method = isEdit ? "PATCH" : "POST";

    const saveBtn = document.getElementById("task-save-btn");
    saveBtn.disabled = true;

    try {
      const res = await apiFetch(path, { method, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        showError(extractErrorMessage(data));
        return;
      }
      taskModal.hide();
      await Promise.all([loadTasks(currentPageUrl), loadStats()]);
    } catch (err) {
      showError("Could not save the task. Please try again.");
    } finally {
      saveBtn.disabled = false;
    }
  });

  // ---- Delete modal ----
  function openDeleteModal(id, title) {
    taskPendingDelete = id;
    document.getElementById("delete-task-title").textContent = title;
    deleteModal.show();
  }

  confirmDeleteBtn.addEventListener("click", async () => {
    if (!taskPendingDelete) return;
    confirmDeleteBtn.disabled = true;
    try {
      const res = await apiFetch(`/tasks/${taskPendingDelete}/`, { method: "DELETE" });
      if (res.status !== 204) {
        const data = await res.json().catch(() => null);
        showError(extractErrorMessage(data));
      } else {
        deleteModal.hide();
        await Promise.all([loadTasks(currentPageUrl), loadStats()]);
      }
    } catch (err) {
      showError("Could not delete the task. Please try again.");
    } finally {
      confirmDeleteBtn.disabled = false;
      taskPendingDelete = null;
    }
  });

  // ---- Filters ----
  [statusFilter, priorityFilter, orderingFilter].forEach((el) =>
    el.addEventListener("change", () => loadTasks())
  );
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => loadTasks(), 400);
  });

  // ---- Initial load ----
  loadTasks();
  loadStats();
});
