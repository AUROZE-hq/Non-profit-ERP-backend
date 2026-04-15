import { User, IUser } from '../models/User';

export const userService = {
	async getAllUsers(): Promise<IUser[]> {
		return User.find({}).select('_id name email role createdAt updatedAt').sort({ createdAt: -1 });
	},
};