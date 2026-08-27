import { createApiOperationsRepository } from "@/features/operations/repositories/api-operations.repository";
import { API_BASE_URL } from "./data-source";

export const operationsApi = createApiOperationsRepository(API_BASE_URL);
