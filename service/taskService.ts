import { Task, ITask } from '../models/Task';

export const taskService = {
  // Get all tasks
  async getAllTasks(): Promise<ITask[]> {
    return await Task.find().sort({ createdAt: -1 }).exec();
  },

  // Get a single task by ID
  async getTaskById(taskId: string): Promise<ITask | null> {
    return await Task.findById(taskId).exec();
  },

  // Create a new task
  async createTask(taskData: Partial<ITask>): Promise<ITask> {
    const newTask = new Task(taskData);
    return await newTask.save();
  },

  // Update an existing task
  async updateTask(taskId: string, updateData: Partial<ITask>): Promise<ITask | null> {
    return await Task.findByIdAndUpdate(taskId, updateData, { new: true }).exec();
  },

  // Delete a task
  async deleteTask(taskId: string): Promise<ITask | null> {
    return await Task.findByIdAndDelete(taskId).exec();
  }
};
