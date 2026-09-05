import React from "react";
import { Text } from "react-native";
import { useTheme } from "expo-router/react-navigation";

// Renders a raw class code (e.g. "44", "4A", "3ème2"...) with its first
// character emphasized and the rest shown smaller — a purely visual treatment
// that reads reasonably whatever the establishment's own naming convention is,
// instead of guessing a semantic meaning (numbers vs letters, position of the
// group number, etc.) that would only hold for some schools.
const ClassLabel = ({ value, color }: { value?: string; color?: string }) => {
  const { colors } = useTheme();
  if (!value) {
    return null;
  }

  const [first, ...rest] = value;
  const suffix = rest.join("");
  const textColor = color ?? String(colors.text) + "88";

  return (
    <Text style={{ color: textColor }}>
      <Text style={{ fontSize: 15, fontWeight: "700" }}>{first}</Text>
      {suffix ? (
        <Text style={{ fontSize: 10, fontWeight: "600" }}>{suffix}</Text>
      ) : null}
    </Text>
  );
};

export default ClassLabel;
