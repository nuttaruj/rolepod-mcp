import {
  browserUploadFileShape,
  ToolNames,
  type BrowserUploadFileInput,
} from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserUploadFileTool: ToolModule<typeof browserUploadFileShape> = {
  name: ToolNames.browserUploadFile,
  description:
    "Attach a local file to the `<input type=file>` element identified by `ref`. `file_path` MUST be an absolute path on the host filesystem. Invalidates all refs on success.",
  inputShape: browserUploadFileShape,
  build(ctx) {
    return safeHandler(async (args: BrowserUploadFileInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      await engine.uploadFile(
        {
          id: args.session_id,
          platform: ctx.registry.platformOf(args.session_id),
        },
        args.ref,
        args.file_path,
      );
      return ok({ uploaded: true, file_path: args.file_path });
    });
  },
};
