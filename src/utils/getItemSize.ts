import type { InternalState } from "@/types";
import { roundSize } from "@/utils/helpers";

export function getItemSize(
    state: InternalState,
    key: string,
    index: number,
    data: any,
    useAverageSize?: boolean,
    defaultAverageSize?: number | undefined,
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

    if (getFixedItemSize) {
        size = getFixedItemSize(index, data);
        if (size !== undefined) {
            sizesKnown.set(key, size);
        }
    }

    // useAverageSize will be false if getEstimatedItemSize is defined
    if (size === undefined && useAverageSize && sizeKnown === undefined && !scrollingTo) {
        // Use item type specific average if available
        const itemType = getItemType ? String(getItemType(data, index) ?? "") : "";
        if (itemType === "") {
            size = defaultAverageSize;
        } else {
            const averageSizeForType = averageSizes[itemType]?.avg;
            if (averageSizeForType !== undefined) {
                size = roundSize(averageSizeForType);
            }
        }
    }

    if (size === undefined) {
        size = sizes.get(key)!;

        if (size !== undefined) {
            return size;
        }
    }

    if (size === undefined) {
        // Get estimated size if we don't have an average or already cached size
        size = getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize!;
    }

    // Save to rendered sizes
    sizes.set(key, size);
    return size;
}
