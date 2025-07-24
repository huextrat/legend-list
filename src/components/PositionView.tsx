// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated, type LayoutChangeEvent, type StyleProp, type View, type ViewStyle } from "react-native";

import { LeanView } from "@/components/LeanView";
import { IsNewArchitecture, POSITION_OUT_OF_VIEW } from "@/constants";
import { useValue$ } from "@/hooks/useValue$";
import { useArr$ } from "@/state/state";
import { typedMemo } from "@/types";

const PositionViewState = typedMemo(function PositionView({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);
    return (
        <LeanView
            ref={refView}
            style={[
                style,
                horizontal ? { transform: [{ translateX: position }] } : { transform: [{ translateY: position }] },
            ]}
            {...rest}
        />
    );
});

// The Animated version is better on old arch but worse on new arch.
// And we don't want to use on new arch because it would make position updates
// not synchronous with the rest of the state updates.
const PositionViewAnimated = typedMemo(function PositionView({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const position$ = useValue$(`containerPosition${id}`, {
        getValue: (v) => v ?? POSITION_OUT_OF_VIEW,
    });

    return (
        <Animated.View
            ref={refView}
            style={[
                style,
                horizontal ? { transform: [{ translateX: position$ }] } : { transform: [{ translateY: position$ }] },
            ]}
            {...rest}
        />
    );
});

export const PositionView = IsNewArchitecture ? PositionViewState : PositionViewAnimated;
