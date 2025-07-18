import { useArr$ } from "@/state/state";
import type { ScrollView, ScrollViewProps } from "react-native";

export interface SnapWrapperProps extends ScrollViewProps {
    ScrollComponent: typeof ScrollView | React.ForwardRefExoticComponent<React.RefAttributes<unknown>>;
}

export function SnapWrapper({ ScrollComponent, ...props }: SnapWrapperProps) {
    const [snapToOffsets] = useArr$(["snapToOffsets"]);

    console.log("snapToOffsets", snapToOffsets);

    return <ScrollComponent {...props} snapToOffsets={snapToOffsets} />;
}
