type ChecklistGroup = {
  title: string;
  items: readonly string[];
};

/** A reading/print reference: intentionally contains no inputs or saved state. */
export function Checklist({ groups }: { groups: readonly ChecklistGroup[] }) {
  return (
    <div className="checklist-grid">
      {groups.map((group, index) => (
        <div key={group.title} className="checklist-group">
          <h3><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{group.title}</h3>
          <ul role="list">
            {group.items.map((item) => (
              <li key={item}><span className="checklist-box" aria-hidden="true" />{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
