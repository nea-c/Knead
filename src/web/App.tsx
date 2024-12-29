import { VersionSelector } from "./VersionSelector"
import { SoundSelector } from "./SoundSelector"
import { ThemeChange } from "./ThemeChange"
import { Footer } from "./Footer"
import { Separator, Flex, Button, Spacer, useColorMode, Box, VStack } from "@yamada-ui/react"


import "./App.css"
import { Configuration } from "./Configuration"



export const App = () => {
  const { colorMode, changeColorMode } = useColorMode()

  const style = document.createElement("style")
  style.textContent += "::-webkit-scrollbar { width: 7px; height: 7px; }"
  if (colorMode === "light") {
    style.textContent += "::-webkit-scrollbar-track { background: var(--ui-colors-blackAlpha-200); border: none; }"
    style.textContent += "::-webkit-scrollbar-thumb { background: var(--ui-colors-blackAlpha-600); border-radius: 10px; }"
  }
  if (colorMode === "dark") {
    style.textContent += "::-webkit-scrollbar-track { background: var(--ui-colors-whiteAlpha-200); border: none; }"
    style.textContent += "::-webkit-scrollbar-thumb { background: var(--ui-colors-whiteAlpha-600); border-radius: 10px; }"
  }
  document.head.appendChild(style)

  return (
    <>
      <VStack padding={2}>
        <Box>
          <Flex w="full" gap="md" paddingBottom={0}>
            <VersionSelector />

            <Spacer />

            <ThemeChange />
            {/* <Configuration /> */}
          </Flex>
          <Separator marginY={2} size="xs" />
          <SoundSelector />
        </Box>
        <Spacer />
      </VStack>
      <Box w="full">
        <Footer />
      </Box>
    </>
  );
};