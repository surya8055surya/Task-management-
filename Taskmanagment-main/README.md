# Task Management API

A full-stack task manager built with **Django REST Framework** (JWT auth,
task CRUD, filtering/search) and a **vanilla HTML5 + Bootstrap 5 + JS**
frontend served by Django templates.

## Features

- **User registration & JWT login** (`djangorestframework-simplejwt`) with
  access + refresh tokens, refresh-token blacklisting on logout, and
  automatic silent token refresh in the frontend on 401s.
- **Task CRUD**, scoped per-user — you can only ever see/edit/delete your
  own tasks (enforced both at the queryset level and via an object-level
  permission).
- **Filtering** by `status`, `priority`, and due-date range
  (`due_before` / `due_after`), **search** across title/description, and
  **ordering** by any field — all via `django-filter` + DRF's built-in
  filter backends.
- A `/api/tasks/stats/` endpoint returning per-status counts, used to
  power the dashboard's summary cards.
- **Bootstrap 5 dashboard**: filter bar, search box, sortable list,
  create/edit modal, delete-confirmation modal, live stats cards —
  no page reloads, everything talks to the API via `fetch()`.
- **Unit tests** (Django's `APITestCase`, built on `unittest`) covering
  registration, login, CRUD, cross-user data isolation, and filtering.

## Tech Stack

| Layer     | Choice                                              |
|-----------|------------------------------------------------------|
| Backend   | Django 5 + Django REST Framework                     |
| Auth      | JWT via `djangorestframework-simplejwt`               |
| Filtering | `django-filter`                                       |
| Database  | SQLite (dev)                                          |
| Frontend  | Django templates + Bootstrap 5 + vanilla JS (`fetch`) |
| Tests     | DRF `APITestCase` (unittest-based)                    |

## Project layout

```
taskmanager_api/
├── manage.py
├── requirements.txt
├── taskmanager/        # project settings & root urls
├── accounts/           # registration, JWT login/refresh, /me, logout
├── tasks/              # Task model, serializer, filters, viewset
├── frontend/           # serves the HTML pages (index, dashboard)
├── templates/           # base.html, index.html, dashboard.html
└── static/
    ├── css/style.css
    └── js/ (api.js, auth.js, dashboard.js)
```

## Setup

```bash
# 1. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create and apply migrations
python manage.py makemigrations
python manage.py migrate

# 4. (optional) create an admin user for /admin/
python manage.py createsuperuser

# 5. Run the dev server
python manage.py runserver
```

Then open **http://127.0.0.1:8000/** — register an account, log in, and
you'll land on the task dashboard.

## Running the tests

```bash
python manage.py test
# or, with pytest + pytest-django installed:
pytest
```

This runs the suites in `accounts/tests.py` (registration & login) and
`tasks/tests.py` (CRUD, ownership isolation, filtering, search, stats).

## API Reference

All endpoints are prefixed with `/api/`. Authenticated endpoints expect
`Authorization: Bearer <access_token>`.

### Auth

| Method | Endpoint              | Auth? | Description                          |
|--------|------------------------|-------|---------------------------------------|
| POST   | `/api/auth/register/`  | No    | Create a new account                  |
| POST   | `/api/auth/login/`     | No    | Get `access` + `refresh` JWT tokens   |
| POST   | `/api/auth/refresh/`   | No    | Exchange `refresh` for a new `access` |
| POST   | `/api/auth/logout/`    | Yes   | Blacklist a refresh token             |
| GET    | `/api/auth/me/`        | Yes   | Current user's profile                |

**Register**

```bash
curl -X POST http://127.0.0.1:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"sanjay","email":"sanjay@example.com","password":"StrongPass123!","password2":"StrongPass123!"}'
```

**Login**

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"sanjay","password":"StrongPass123!"}'
# -> {"access": "...", "refresh": "..."}
```

### Tasks

| Method | Endpoint             | Description                          |
|--------|-----------------------|---------------------------------------|
| GET    | `/api/tasks/`          | List your tasks (paginated, filterable) |
| POST   | `/api/tasks/`          | Create a task                         |
| GET    | `/api/tasks/{id}/`     | Retrieve one task                     |
| PUT    | `/api/tasks/{id}/`     | Full update                           |
| PATCH  | `/api/tasks/{id}/`     | Partial update                        |
| DELETE | `/api/tasks/{id}/`     | Delete                                |
| GET    | `/api/tasks/stats/`    | `{total, todo, in_progress, done}`    |

Query params on `GET /api/tasks/`:

- `status=todo|in_progress|done`
- `priority=low|medium|high`
- `due_before=YYYY-MM-DD`, `due_after=YYYY-MM-DD`
- `search=<text>` (matches title & description)
- `ordering=due_date`, `-priority`, `created_at`, etc.

```bash
curl http://127.0.0.1:8000/api/tasks/?status=todo&priority=high \
  -H "Authorization: Bearer <access_token>"

curl -X POST http://127.0.0.1:8000/api/tasks/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Write README","priority":"high","status":"todo","due_date":"2026-08-01"}'
```

## Troubleshooting

**`django.db.utils.OperationalError: no such table: tasks_task` (or `accounts_...`)**
Migration files for that app haven't been generated yet — `migrate` only
*applies* migrations, it doesn't create them. Run:
```bash
python manage.py makemigrations
python manage.py migrate
```
You should see `Migrations for 'tasks': ... Create model Task` before it
applies. This is the most common first-run error.

**"Could not save the task" / other generic errors in the dashboard UI**
The frontend shows this fallback message whenever the API call fails or
the response isn't valid JSON. Open DevTools → **Network** tab → find the
failing request → check its **Status** and **Response**:
- **500** → check the terminal running `runserver` for a Python
  traceback (usually a migrations or DB issue, see above).
- **401** → your access token expired and the silent refresh also
  failed. Log out and log back in.
- **400** with a JSON body → a real validation error (e.g. blank title);
  the message shown should reflect it, but check Response to confirm.
- Nothing shows up in the Network tab at all → the dev server isn't
  running, or you're pointed at the wrong port/host.

**`ModuleNotFoundError: No module named 'django'` (or `rest_framework`, etc.)**
Your virtual environment isn't active, or `pip install -r requirements.txt`
didn't run inside it. Confirm `(venv)` shows in your shell prompt, then
re-run `pip install -r requirements.txt`.

**`CommandError: You must set settings.ALLOWED_HOSTS`**
Only relevant if you set `DJANGO_DEBUG=False`. For local dev just leave
the default (`DEBUG=True`), or set `ALLOWED_HOSTS` appropriately.

**Static files (Bootstrap styling, JS) not loading**
Make sure `DEBUG=True` for local dev (Django serves `static/` automatically
in that mode). For a production-style run, you'd need to
`python manage.py collectstatic` and serve `STATIC_ROOT` via your web
server or whitenoise.

**Login works but the dashboard immediately kicks you back to `/`**
`dashboard.js` redirects to `/` if there's no access token in
`localStorage`. This usually means the login `fetch()` failed silently —
check the Network tab on the login request itself.

## Notes & possible extensions

- Tokens are stored in `localStorage` in the demo frontend for simplicity.
  For a production app you'd typically use an httpOnly cookie for the
  refresh token to reduce XSS exposure.
- `SECRET_KEY`/`DEBUG` are read from environment variables with dev-safe
  defaults — set real values before deploying anywhere public.
- Natural next steps: task tags/categories, pagination page-size control
  in the UI, per-task comments, email verification on registration.