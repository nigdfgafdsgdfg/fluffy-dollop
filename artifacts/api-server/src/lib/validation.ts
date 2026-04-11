import { z } from "zod";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const SAFE_URL_RE = /^https?:\/\/.+/;

export const CreateUserProfileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be 20 characters or fewer")
    .regex(USERNAME_RE, "Username may only contain lowercase letters, numbers, and underscores"),
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(50, "Display name must be 50 characters or fewer")
    .trim(),
  bio: z
    .string()
    .max(160, "Bio must be 160 characters or fewer")
    .trim()
    .nullable()
    .optional()
    .default(null),
  avatarUrl: z
    .string()
    .max(500, "Avatar URL is too long")
    .regex(SAFE_URL_RE, "Avatar URL must start with http:// or https://")
    .nullable()
    .optional()
    .default(null),
});

export const CreatePostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Post content cannot be empty")
    .max(280, "Post content must be 280 characters or fewer"),
});

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
});

export const UserIdParamSchema = z.object({
  userId: z.string().min(1).max(128),
});

export const PostIdParamSchema = z.object({
  postId: z.string().min(1).max(128),
});

export const TargetUserIdParamSchema = z.object({
  targetUserId: z.string().min(1).max(128),
});
