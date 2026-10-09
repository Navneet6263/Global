/**
 * Field Executive work (physical visits) is switched off until it launches
 * (frontend: FIELD_WORK_ENABLED). While off, an Address check does not wait for a
 * physical visit before QA; set FIELD_WORK_ENABLED=true to require it again.
 */
export const fieldWorkEnabled = () => process.env.FIELD_WORK_ENABLED === "true";
