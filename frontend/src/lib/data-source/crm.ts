import { createApiCrmRepository } from "@/features/crm/repositories/api-crm.repository";
import { API_BASE_URL } from "./data-source";

export const crmApi = createApiCrmRepository(API_BASE_URL);
