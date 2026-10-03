# Employee Task Management System

A full-stack web application for creating, managing, searching, filtering and sorting employee tasks. Built with Java and Spring Boot, using a REST API and a plain HTML/CSS/JavaScript frontend.

## Features

- **Dashboard** showing total, pending, in-progress and completed task counts
- **Add, edit and delete** tasks (delete asks for confirmation)
- **Change status** (Pending / In Progress / Completed) directly from the table
- **Search** tasks by title
- **Filter** by status, priority and assigned employee
- **Sorting** by title, assignee, priority, status or due date (click a column header; click again to reverse)
- **Task assignment** to an employee
- **Validation** on both the frontend (JavaScript) and the backend (Bean Validation) with clear JSON error responses
- **User-visible error messages**: a banner appears if the server is unreachable or a task no longer exists
- **Overdue highlighting** for unfinished tasks past their due date
- **Persistent storage** in an H2 file database (data survives restarts)
- Responsive layout for smaller screens

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript (no framework) |
| Backend | Java 17, Spring Boot 3, Spring Web, Spring Data JPA |
| Validation | Jakarta Bean Validation |
| Database | H2 (file mode) |
| Build tool | Maven |

## Prerequisites

- JDK 17 or newer
- Maven (or Eclipse / IntelliJ with Maven support)

## Setup and Run

### Option 1: Command line
```bash
git clone https://github.com/Valacy4/employee-task-manager.git
cd employee-task-manager
mvn spring-boot:run
```

### Option 2: Eclipse
1. **File > Import > Maven > Existing Maven Projects** and select the project folder.
2. Right-click the project > **Maven > Update Project**.
3. Right-click `TaskManagerApplication.java` > **Run As > Java Application**.

Then open **http://localhost:8080**.

The database is created automatically in a `data/` folder on first run. To reset all data, stop the app and delete that folder.

Optional H2 console: http://localhost:8080/h2-console
(JDBC URL `jdbc:h2:file:./data/taskdb`, user `sa`, empty password)

## REST API

Base URL: `http://localhost:8080/api/tasks`

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| GET | `/api/tasks` | List tasks (supports query params below) | 200 |
| GET | `/api/tasks/stats` | Dashboard counts | 200 |
| GET | `/api/tasks/{id}` | Get one task | 200 |
| POST | `/api/tasks` | Create a task | 201 |
| PUT | `/api/tasks/{id}` | Update a task | 200 |
| PATCH | `/api/tasks/{id}/status` | Change only the status | 200 |
| DELETE | `/api/tasks/{id}` | Delete a task | 204 |

**Query parameters for `GET /api/tasks`**

| Param | Example | Description |
|-------|---------|-------------|
| `search` | `report` | Title contains text (case-insensitive) |
| `status` | `PENDING` | `PENDING`, `IN_PROGRESS`, `COMPLETED` |
| `priority` | `HIGH` | `LOW`, `MEDIUM`, `HIGH` |
| `assignedTo` | `john` | Assignee contains text |
| `sortBy` | `priority` | `title`, `assignedTo`, `priority`, `status`, `dueDate` (default) |
| `dir` | `desc` | `asc` (default) or `desc` |

**Example request body (POST / PUT)**
```json
{
  "title": "Prepare report",
  "description": "Q3 numbers",
  "assignedTo": "John",
  "priority": "HIGH",
  "status": "PENDING",
  "dueDate": "2026-10-15"
}
```

## Error Handling

**Backend** (`GlobalExceptionHandler`) returns JSON errors instead of server crashes:

| Situation | Status | Body |
|-----------|--------|------|
| Validation failed | 400 | `{"error":"Validation failed","fields":{"title":"Title is required"}}` |
| Bad JSON, bad date or enum value | 400 | `{"error":"Invalid request body ..."}` |
| Invalid status in PATCH | 400 | `{"error":"Invalid status"}` |
| Task not found | 404 | `{"error":"Task not found"}` |

**Frontend** (`app.js`) sends every request through one `api()` helper:
- Field errors from the backend are shown under the matching form field.
- Network failures ("server not running") and other errors appear in a red banner at the top of the page for 5 seconds.
- After a failed status change or delete, the table reloads so it always matches the server (for example, when a task was already deleted in another tab).

## Database

Single table `tasks`:

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT | Primary key, auto-generated |
| title | VARCHAR(255) | Required, max 100 characters |
| description | VARCHAR(500) | Optional |
| assigned_to | VARCHAR(255) | Optional, max 100 characters |
| priority | VARCHAR | LOW / MEDIUM / HIGH |
| status | VARCHAR | PENDING / IN_PROGRESS / COMPLETED |
| due_date | DATE | Required |

## Project Structure

```
src/main/java/com/example/taskmanager/
  TaskManagerApplication.java    Application entry point
  Task.java                      JPA entity + validation rules
  TaskRepository.java            Database access (Spring Data JPA)
  TaskController.java            REST endpoints, filtering and sorting
  GlobalExceptionHandler.java    Converts errors into JSON responses
src/main/resources/
  application.properties         Server and database configuration
  static/
    index.html                   Page layout
    style.css                    Styling
    app.js                       Frontend logic (fetch calls, rendering, validation, error banner)
```

## How a Request Flows (example: adding a task)

1. The user fills the form and clicks **Add Task**; `app.js` validates the fields.
2. `app.js` sends `POST /api/tasks` with the task as JSON.
3. `TaskController.createTask` receives it; `@Valid` checks it against the rules in `Task.java`.
4. `TaskRepository.save` inserts the row into the H2 database.
5. The controller returns the saved task with status `201`; the page reloads the table and dashboard.
6. If validation fails, `GlobalExceptionHandler` returns a `400` with per-field messages, which the form displays.

## Possible Improvements

- Separate `employees` table with a foreign key instead of a free-text assignee
- User login / logout with Spring Security
- Pagination for large task lists
- Switch from H2 to MySQL or PostgreSQL
- Automated tests (JUnit and MockMvc)

## Author

Valacy4 — https://github.com/Valacy4
