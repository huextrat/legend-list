import type { InternalState } from "@/types";
import { roundSize } from "@/utils/helpers";

export function getItemSize(
    state: InternalState,
    key: string,
    index: number,
    data: any,
    useAverageSize?: boolean,
    defaultAverageSize?: number | undefined,
    preferRenderedCache?: boolean,
) {
    const {
        sizesKnown,
        sizes,
        scrollingTo,
        averageSizes,
        props: { estimatedItemSize, getEstimatedItemSize, getFixedItemSize, getItemType },
    } = state;
    const sizeKnown = sizesKnown.get(key)!;
    if (sizeKnown !== undefined) {
        return sizeKnown;
    }

    let size: number | undefined;

    const itemType = getItemType ? (getItemType(data, index) ?? "") : "";

    if (getFixedItemSize) {
        size = getFixedItemSize(index, data, itemType);
        if (size !== undefined) {
            sizesKnown.set(key, size);
        }
    }

    // Fetch rendered size once to avoid duplicate Map lookups
    const renderedSize = sizes.get(key);

    // Determine ordering between rendered cache and averages
    // Default behavior: averages before rendered cache
    // preferRenderedCache=true: rendered cache (sizes) before averages
    if (size === undefined && preferRenderedCache && renderedSize !== undefined) {
        return renderedSize;
    }

    // useAverageSize will be false if getEstimatedItemSize is defined
    if (size === undefined && useAverageSize && !scrollingTo) {
        // Use item type specific average if available
        if (itemType === "") {
            size = defaultAverageSize;
        } else {
            const averageSizeForType = averageSizes[itemType]?.avg;
            if (averageSizeForType !== undefined) {
                size = roundSize(averageSizeForType);
            }
        }
    }

    if (size === undefined && renderedSize !== undefined) {
        return renderedSize;
    }

    if (size === undefined) {
        // Get estimated size if we don't have an average or already cached size
        size = getEstimatedItemSize ? getEstimatedItemSize(index, data, itemType) : estimatedItemSize!;
    }

    // Save to rendered sizes
    sizes.set(key, size);
    return size;
}
