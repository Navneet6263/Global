import { Injectable } from "@nestjs/common";
import { SecretBoxService } from "./secret-box.service";

export interface SubjectPii {
  email?: string;
  phone?: string;
  employeeCode?: string;
}

type StoredSubject = {
  email?: string | null;
  phone?: string | null;
  employeeCode?: string | null;
  piiCiphertext?: string | null;
};

@Injectable()
export class SubjectPiiService {
  constructor(private readonly secretBox: SecretBoxService) {}

  seal(input: SubjectPii): string | null {
    const normalized: SubjectPii = {
      ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.phone ? { phone: input.phone.trim() } : {}),
      ...(input.employeeCode
        ? { employeeCode: input.employeeCode.trim() }
        : {}),
    };
    return Object.keys(normalized).length
      ? this.secretBox.seal(normalized)
      : null;
  }

  open(subject: StoredSubject): SubjectPii {
    if (subject.piiCiphertext) {
      return this.secretBox.open<SubjectPii>(subject.piiCiphertext);
    }
    return {
      ...(subject.email ? { email: subject.email } : {}),
      ...(subject.phone ? { phone: subject.phone } : {}),
      ...(subject.employeeCode ? { employeeCode: subject.employeeCode } : {}),
    };
  }

  present<T extends StoredSubject>(subject: T) {
    const { piiCiphertext, ...safe } = subject;
    void piiCiphertext;
    const pii = this.open(subject);
    return {
      ...safe,
      email: pii.email ?? null,
      phone: pii.phone ?? null,
      employeeCode: pii.employeeCode ?? null,
    };
  }
}
