#include <jni.h>
#include "react-native-bluetooth-nitro-nexus.h"

extern "C"
JNIEXPORT jdouble JNICALL
Java_com_bluetoothnitronexus_BluetoothNitroNexusModule_nativeMultiply(JNIEnv *env, jclass type, jdouble a, jdouble b) {
    return bluetoothnitronexus::multiply(a, b);
}
