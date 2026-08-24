import { Global, Module } from "@nestjs/common";
import { SecretBoxService } from "./secret-box.service";
import { SubjectPiiService } from "./subject-pii.service";

@Global()
@Module({
  providers: [SecretBoxService, SubjectPiiService],
  exports: [SecretBoxService, SubjectPiiService],
})
export class SecurityModule {}
