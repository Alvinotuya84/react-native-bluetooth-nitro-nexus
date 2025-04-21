#import "BluetoothNitroNexus.h"

@implementation BluetoothNitroNexus
RCT_EXPORT_MODULE()

- (NSNumber *)multiply:(double)a b:(double)b {
    NSNumber *result = @(bluetoothnitronexus::multiply(a, b));

    return result;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeBluetoothNitroNexusSpecJSI>(params);
}

@end
