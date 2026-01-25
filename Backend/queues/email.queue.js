import { Queue } from "bullmq";
import bullRedis from "../config/bullRedis.js";

export const emailQueue = new Queue("emailQueue", {
  connection: bullRedis,
});