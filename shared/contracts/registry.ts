import { z } from 'zod';

export const RegistryDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const RegistryDepartmentsResponseSchema = z.array(
  RegistryDepartmentSchema,
);

const DepartmentDetailsRequestSchema = z.object({
  name: z.string().trim().min(1, 'Enter a department name.'),
  description: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
});

export const CreateDepartmentRequestSchema = DepartmentDetailsRequestSchema;
export const UpdateDepartmentRequestSchema = DepartmentDetailsRequestSchema;

export type RegistryDepartment = z.infer<typeof RegistryDepartmentSchema>;
export type CreateDepartmentRequest = z.infer<
  typeof CreateDepartmentRequestSchema
>;
export type UpdateDepartmentRequest = z.infer<
  typeof UpdateDepartmentRequestSchema
>;
export type DepartmentFormValues = z.input<
  typeof DepartmentDetailsRequestSchema
>;
