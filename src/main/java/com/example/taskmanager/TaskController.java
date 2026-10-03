package com.example.taskmanager;

import jakarta.validation.Valid;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Comparator;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskRepository repo;

    public TaskController(TaskRepository repo) {
        this.repo = repo;
    }

    // GET /api/tasks?search=&status=&priority=&assignedTo=&sortBy=dueDate&dir=asc
    @GetMapping
    public List<Task> getTasks(@RequestParam(required = false) String search,
                               @RequestParam(required = false) Task.Status status,
                               @RequestParam(required = false) Task.Priority priority,
                               @RequestParam(required = false) String assignedTo,
                               @RequestParam(defaultValue = "dueDate") String sortBy,
                               @RequestParam(defaultValue = "asc") String dir) {

        Comparator<Task> comparator = switch (sortBy) {
            case "title" -> Comparator.comparing((Task t) -> t.getTitle().toLowerCase());
            case "assignedTo" -> Comparator.comparing(
                    (Task t) -> t.getAssignedTo() == null ? "" : t.getAssignedTo().toLowerCase());
            case "priority" -> Comparator.comparing((Task t) -> t.getPriority()); // LOW < MEDIUM < HIGH
            case "status" -> Comparator.comparing((Task t) -> t.getStatus());
            default -> Comparator.comparing((Task t) -> t.getDueDate());
        };
        if ("desc".equalsIgnoreCase(dir)) {
            comparator = comparator.reversed();
        }

        return repo.findAll().stream()
                .filter(t -> search == null || search.isBlank()
                        || t.getTitle().toLowerCase().contains(search.trim().toLowerCase()))
                .filter(t -> status == null || t.getStatus() == status)
                .filter(t -> priority == null || t.getPriority() == priority)
                .filter(t -> assignedTo == null || assignedTo.isBlank()
                        || (t.getAssignedTo() != null
                            && t.getAssignedTo().toLowerCase().contains(assignedTo.trim().toLowerCase())))
                .sorted(comparator)
                .toList();
    }
    // GET /api/tasks/stats  -> dashboard numbers
    @GetMapping("/stats")
    public Map<String, Long> getStats() {
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("total", repo.count());
        stats.put("pending", repo.countByStatus(Task.Status.PENDING));
        stats.put("inProgress", repo.countByStatus(Task.Status.IN_PROGRESS));
        stats.put("completed", repo.countByStatus(Task.Status.COMPLETED));
        return stats;
    }

    @GetMapping("/{id}")
    public Task getTask(@PathVariable Long id) {
        return findOr404(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Task createTask(@Valid @RequestBody Task task) {
        task.setId(null); // make sure a new row is created
        return repo.save(task);
    }

    @PutMapping("/{id}")
    public Task updateTask(@PathVariable Long id, @Valid @RequestBody Task updated) {
        Task task = findOr404(id);
        task.setTitle(updated.getTitle());
        task.setDescription(updated.getDescription());
        task.setPriority(updated.getPriority());
        task.setStatus(updated.getStatus());
        task.setDueDate(updated.getDueDate());
        task.setAssignedTo(updated.getAssignedTo());
        return repo.save(task);
    }

    // PATCH /api/tasks/5/status  body: {"status":"COMPLETED"}
    @PatchMapping("/{id}/status")
    public Task updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Task task = findOr404(id);
        try {
            task.setStatus(Task.Status.valueOf(body.get("status")));
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
        }
        return repo.save(task);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        findOr404(id);
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Task findOr404(Long id) {
        return repo.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    }
}