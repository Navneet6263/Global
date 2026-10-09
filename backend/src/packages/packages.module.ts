import { Module } from "@nestjs/common";
import {
  ClientPricingController,
  PackagesController,
} from "./packages.controller";
import { PackagesService } from "./packages.service";

@Module({
  controllers: [PackagesController, ClientPricingController],
  providers: [PackagesService],
})
export class PackagesModule {}
