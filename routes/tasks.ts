import express, { Request, Response } from 'express';
import { taskService } from '../service/taskService';

const router = express.Router();

// Get all tasks
router.get('/', async (req: Request, res: Response) => {
  try {
    const tasks = await taskService.getAllTasks();
    res.json({ success: true, tasks });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch tasks' });
  }
});

// Get a single task by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, task });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch task' });
  }
});

// Create a new task
router.post('/', async (req: Request, res: Response) => {
  try {
    const task = await taskService.createTask(req.body);
    res.status(201).json({ success: true, task });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to create task' });
  }
});

// Update a task
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, task });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to update task' });
  }
});

// Delete a task
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const task = await taskService.deleteTask(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete task' });
  }
});

export default router;
