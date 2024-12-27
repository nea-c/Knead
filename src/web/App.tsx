import { VersionSelector } from "./VersionSelector"
// import { SoundSelector } from "./SoundSelector"
// import { Configuration } from "./Configuration"
import { Footer } from "./Footer"
import { Separator, Flex, Button, Spacer, useColorMode } from "@yamada-ui/react"


export const App = () => {

  return (
    <>
      <Flex w="full" gap="md" padding={1} paddingBottom={0}>
        <VersionSelector />

        <Spacer />

        {/* <Configuration /> */}
      </Flex>
      <Separator margin={1} size="xs" />
    </>
  );
};