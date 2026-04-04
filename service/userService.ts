import { User, IUser } from '../models/User';

export const userService = {
	async getAllUsers(): Promise<IUser[]> {
		return User.find({}).sort({ createdAt: -1 });
	},
};