import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";

export interface PermissionItem {
  id: number;
  key: string;
  name: string;
  groupName: string;
  description: string | null;
}

interface GroupedPermissions {
  group: string;
  permissions: PermissionItem[];
}

interface UserPermissionsEditorProps {
  allPermissions: PermissionItem[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  readOnly?: boolean;
}

export function UserPermissionsEditor({
  allPermissions,
  selectedIds,
  onChange,
  readOnly = false,
}: UserPermissionsEditorProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionItem[]>();
    for (const p of allPermissions) {
      const arr = map.get(p.groupName) ?? [];
      arr.push(p);
      map.set(p.groupName, arr);
    }
    return Array.from(map.entries()).map(([group, permissions]) => ({
      group,
      permissions,
    }));
  }, [allPermissions]);

  const handleToggleAll = (group: GroupedPermissions) => {
    const groupIds = new Set(group.permissions.map(p => p.id));
    const allSelected = group.permissions.every(p =>
      selectedIds.includes(p.id)
    );

    if (allSelected) {
      onChange(selectedIds.filter(id => !groupIds.has(id)));
    } else {
      const newIds = [...selectedIds];
      for (const p of group.permissions) {
        if (!newIds.includes(p.id)) newIds.push(p.id);
      }
      onChange(newIds);
    }
  };

  const handleToggle = (permId: number) => {
    if (selectedIds.includes(permId)) {
      onChange(selectedIds.filter(id => id !== permId));
    } else {
      onChange([...selectedIds, permId]);
    }
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {grouped.map(group => {
        const allSelected = group.permissions.every(p =>
          selectedIds.includes(p.id)
        );
        const someSelected = group.permissions.some(p =>
          selectedIds.includes(p.id)
        );
        const collapsed = collapsedGroups.has(group.group);

        return (
          <div
            key={group.group}
            className="rounded-xl border bg-muted/10 overflow-hidden"
          >
            {/* Cabecera del grupo */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
              <button
                type="button"
                onClick={() => toggleGroup(group.group)}
                className="text-muted-foreground"
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              <span className="flex-1 font-medium text-sm">{group.group}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleToggleAll(group)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition ${
                    allSelected
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {allSelected
                    ? "✓ Todos"
                    : someSelected
                      ? "Marcar todos"
                      : "Marcar todos"}
                </button>
              )}
            </div>

            {/* Ítems */}
            {!collapsed && (
              <div className="p-1">
                {group.permissions.map(perm => {
                  const isChecked = selectedIds.includes(perm.id);
                  return (
                    <label
                      key={perm.id}
                      className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition ${
                        readOnly ? "cursor-default" : "hover:bg-muted/50"
                      }`}
                    >
                      {readOnly ? (
                        <div
                          className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                            isChecked
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isChecked && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggle(perm.id)}
                          className="shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{perm.name}</span>
                        {perm.description && (
                          <span className="text-[10px] text-muted-foreground ml-2 hidden md:inline">
                            — {perm.description}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
