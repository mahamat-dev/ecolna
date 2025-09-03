export function AttachmentsList({ items }:{ items: Array<{ fileId: string }> }){
  if (!items?.length) return null;
  return (
    <ul className="text-sm list-disc pl-5">
      {items.map((a)=> (
        <li key={a.fileId} className="break-all">{a.fileId}</li>
      ))}
    </ul>
  );
}

