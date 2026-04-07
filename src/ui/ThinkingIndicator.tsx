import React, { useEffect, useState } from "react";
import { Text } from "ink";

export function ThinkingIndicator() {
	const [dots, setDots] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setDots(d => (d + 1) % 4);
		}, 500);
		return () => clearInterval(interval);
	}, []);

	return (
		<Text color="dim">[thinking{'.'.repeat(dots)}{' '.repeat(3 - dots)}]</Text>
	);
}
