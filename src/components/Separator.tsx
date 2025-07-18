import { useArr$ } from "@/state/state";

export interface SeparatorProps<ItemT> {
    ItemSeparatorComponent: React.ComponentType<{ leadingItem: ItemT }>;
    itemKey: string;
    leadingItem: ItemT;
}

export function Separator<ItemT>({ ItemSeparatorComponent, itemKey, leadingItem }: SeparatorProps<ItemT>) {
    const [lastItemKeys] = useArr$(["lastItemKeys"]);
    const isALastItem = lastItemKeys.includes(itemKey);

    return isALastItem ? null : <ItemSeparatorComponent leadingItem={leadingItem} />;
}
