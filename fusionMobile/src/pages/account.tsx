import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import { generatePrivateKey, getPublicKey, nip19 } from "nostr-tools";
import PapaParse from "papaparse";
import React from "react";
import {
  StyleSheet,
  Text,
  View,
  Alert,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
  ScrollView,
} from "react-native";

import { PromptResponse } from "~/@types";
import { Button, Input, Screen } from "~/components";
import { promptService, nostrService } from "~/services";
import { appInsights, maskPromptId, saveFileToDevice } from "~/utils";

export function AccountScreen() {
  const [feedbackText, setFeedbackText] = React.useState("");

  const [nostrAccount, setNostrAccount] = React.useState<{
    npub: string;
    pubkey: string;
    privkey: string;
  } | null>(null);

  React.useEffect(() => {
    appInsights.trackPageView({
      name: "Account",
    });

    (async () => {
      setNostrAccount(await nostrService.getNostrAccount());
      setBrainRecordingEnabled(await getResearchProgramStatus());
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      if (!nostrAccount) {
        // generate a new account for user
        const privkey = generatePrivateKey();

        const pubkey = getPublicKey(privkey);
        const npub = nip19.npubEncode(pubkey);

        const saveStatus = await nostrService.createNostrAccount(
          npub,
          pubkey,
          privkey
        );
        if (saveStatus) {
          setNostrAccount(await nostrService.getNostrAccount());
        }
      } else {
        // let's query for an event that exists
        // try {
        //   // await crypto.ensureSecure();
        //   await relay.connect();
        //   let sub = relay.sub(
        //     [
        //       {
        //         kinds: [4],
        //         "#p": [nostrAccount.pubkey],
        //         since: Math.floor(now.current / 1000),
        //       },
        //     ],
        //     {}
        //   );
        //   sub.on("event", async (event) => {
        //     console.log("we got the event we wanted:", event);
        //     console.log("decoding...");
        //     const decoded = await nip04.decrypt(
        //       nostrAccount.privkey,
        //       "fdf7a56cb4113a3a520cad232959838ccc907b593c9f8871e5cce86b18cd6edd",
        //       event.content
        //     );
        //     console.log("access token", decoded);
        //   });
        // } catch (error) {
        //   console.log(error);
        // }
        // try {
        //   // make api call to backend server to get a token for account
        //   const res = await axios.post("http://localhost:4000/api/nostrlogin", {
        //     pubkey: nostrAccount.pubkey,
        //   });
        //   console.log(res.status);
        //   console.log(res.data);
        // } catch (error) {
        //   console.log(error);
        // }
        // store the authToken in secure store
      }
    })();
  }, [nostrAccount]);

  const [brainRecordingEnabled, setBrainRecordingEnabled] =
    React.useState(false);

  const getResearchProgramStatus = async () => {
    const researchProgramMember = await AsyncStorage.getItem(
      "researchProgramMember"
    );

    if (researchProgramMember === "true") {
      return true;
    } else {
      return false;
    }
  };

  const handleBrainRecordingToggle = async () => {
    // toggle brain recording value
    console.log(
      "about to toggle brain recording value from",
      brainRecordingEnabled
    );
    if (brainRecordingEnabled === true) {
      await AsyncStorage.setItem("researchProgramMember", "false");
    } else {
      await AsyncStorage.setItem("researchProgramMember", "true");
    }
    setBrainRecordingEnabled(!brainRecordingEnabled);
  };

  const exportData = async (dataType: string) => {
    // get all the available prompts
    // get all the responses
    // TODO: have user select what prompts to share
    try {
      const prompts = await promptService.readSavedPrompts();
      if (!prompts || prompts.length < 1) {
        Alert.alert("No prompts to export");
        return;
      }

      const exportTimestamp = dayjs().unix().toString();
      if (dataType === "prompts") {
        console.log("exporting prompts");
        const maskingPromptIds = prompts.map(async (prompt) => {
          return (prompt.uuid = await maskPromptId(prompt.uuid));
        });
        await Promise.all(maskingPromptIds);
        const promptsCsv = PapaParse.unparse(prompts);
        const promptsLocalPath = await saveFileToDevice(
          `fusionPrompts_${exportTimestamp}.csv`,
          promptsCsv,
          true
        );
      } else if (dataType === "responses") {
        console.log("exporting responses");
        // generare & write response_<timestamp>.csv
        const combinedResponses: PromptResponse[] = [];
        await promptService.processPromptResponses(prompts, combinedResponses);
        const promptResponsesCsv = PapaParse.unparse(combinedResponses);
        const responsesLocalPath = await saveFileToDevice(
          `fusionResponses_${exportTimestamp}.csv`,
          promptResponsesCsv,
          true
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={{ width: "100%" }}
            className="mt-10"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: "center" }}>
              <Text className="font-sans text-center text-base text-white">
                Hey there, you're using Fusion anonymously!
              </Text>
            </View>
            <View style={{ alignItems: "center", marginTop: 20 }}>
              <Text className="font-sans text-center text-base text-white">
                We value your privacy and data security.{"\n"}Your prompts and
                responses are stored solely on your device, not our servers.
                {"\n\n"}Rest assured, your entries remain private and
                inaccessible to anyone else unless you decide to share them.
              </Text>
            </View>

            {/* Feedback component */}
            <View className="mt-8">
              <Input
                multiline
                numberOfLines={4}
                onChangeText={setFeedbackText}
                placeholder="Have an idea for something you'd like to see? Or question? Type in here!"
                value={feedbackText}
                className="pt-3 leading-1.5 mb-8"
                style={{ height: 112 }}
              />

              <Button
                title="Send Feedback"
                onPress={async () => {
                  // send feedback
                  const recipient = "contact@usefusion.app";
                  const subject = "Fusion Feedback";
                  const body = feedbackText;

                  const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(
                    subject
                  )}&body=${encodeURIComponent(body)}`;

                  Alert.alert(
                    "Send Feedback",
                    "About to navigate to your mail app. Continue",
                    [
                      {
                        text: "Cancel",
                        style: "cancel",
                      },
                      {
                        text: "OK",
                        onPress: () => {
                          setFeedbackText("");
                          Linking.openURL(mailtoUrl);
                        },
                      },
                    ]
                  );
                }}
                fullWidth
              />
            </View>

            {/* Export Data */}
            <View className="mt-10 mb-10 gap-y-5 pt-10">
              <Button
                title="Export Prompts"
                variant="ghost"
                fullWidth
                onPress={async () => await exportData("prompts")}
              />
              <Button
                title="Export Responses"
                variant="ghost"
                fullWidth
                onPress={async () => await exportData("responses")}
              />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: "#fff",
    alignItems: "center",
    padding: 10,
  },
});
