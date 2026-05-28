import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { AttachmentsPanel } from "./attachments-panel";
import { fetchAttachments } from "./fetch";
import type { AttachmentEntityType } from "./actions";

type Props = {
  entityType: AttachmentEntityType;
  entityId: string;
  // Path the detail page lives at, so the server actions know what to
  // revalidate after upload/delete.
  revalidatePath: string;
};

// Server Component wrapper: fetches the list and passes everything into the
// client panel. Detail pages just `<AttachmentsCard entityType="..." />`.
export async function AttachmentsCard({
  entityType,
  entityId,
  revalidatePath,
}: Props) {
  const { attachments, currentUserId, currentUserRole } =
    await fetchAttachments(entityType, entityId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attachments</CardTitle>
        <CardDescription>
          Files attached to this {entityType}. The bucket is public — anyone
          with the URL can open the file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AttachmentsPanel
          entityType={entityType}
          entityId={entityId}
          attachments={attachments}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          revalidatePath={revalidatePath}
        />
      </CardContent>
    </Card>
  );
}
