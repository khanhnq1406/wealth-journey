"use client";

import React, { useState, useEffect, useRef, useCallback, memo, startTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SortableListProps<T extends { id: string | number }> {
  items: T[];
  onReorder: (newOrder: T[]) => void;
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
  renderOverlay?: (item: T) => React.ReactNode;
  className?: string;
  hideDragHandle?: boolean;
}

function SortableRow<T extends { id: string | number }>({
  item,
  renderItem,
  hideDragHandle,
}: {
  item: T;
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
  hideDragHandle?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 1 : ("auto" as const),
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      {!hideDragHandle && (
        <span
          {...attributes}
          {...listeners}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-grab active:cursor-grabbing text-v2-text-tertiary hover:text-v2-text-secondary transition-colors duration-150 flex-shrink-0"
          style={{ touchAction: "none" }}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </span>
      )}
      <div className="flex-1 min-w-0">{renderItem(item, isDragging)}</div>
    </div>
  );
}

export const SortableList = memo(function SortableList<
  T extends { id: string | number },
>({
  items,
  onReorder,
  renderItem,
  className,
  hideDragHandle,
}: SortableListProps<T>) {
  const [localItems, setLocalItems] = useState<T[]>(items);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      startTransition(() => {
        setLocalItems(items);
      });
    }
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      isDraggingRef.current = false;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = localItems.findIndex((i) => i.id === active.id);
      const newIndex = localItems.findIndex((i) => i.id === over.id);
      const newOrder = arrayMove(localItems, oldIndex, newIndex);
      setLocalItems(newOrder);
      onReorder(newOrder);
    },
    [localItems, onReorder]
  );

  return (
    <div className={cn("w-full", className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        <SortableContext
          items={localItems.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {localItems.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              renderItem={renderItem}
              hideDragHandle={hideDragHandle}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}) as <T extends { id: string | number }>(
  props: SortableListProps<T>
) => React.ReactElement;
