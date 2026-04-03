import Foundation
import Capacitor
import GoogleSignIn

@objc(GoogleSignInPlugin)
public class GoogleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GoogleSignInPlugin"
    public let jsName = "GoogleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    @objc func signIn(_ call: CAPPluginCall) {
        guard let viewController = self.bridge?.viewController else {
            call.reject("No view controller available")
            return
        }

        // Read iOS Client ID from capacitor.config.ts
        let clientId = "327555950087-gf20mpijriteeprqstnabv4gn5mppg5i.apps.googleusercontent.com"
        let config = GIDConfiguration(clientID: clientId)
        GIDSignIn.sharedInstance.configuration = config

        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { result, error in
                if let error = error {
                    let nsError = error as NSError
                    if nsError.code == GIDSignInError.canceled.rawValue {
                        call.reject("User cancelled", "12501")
                        return
                    }
                    call.reject(error.localizedDescription)
                    return
                }

                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString else {
                    call.reject("No ID token received from Google")
                    return
                }

                call.resolve([
                    "idToken": idToken,
                    "email": user.profile?.email ?? "",
                    "displayName": user.profile?.name ?? "",
                    "givenName": user.profile?.givenName ?? "",
                    "familyName": user.profile?.familyName ?? ""
                ])
            }
        }
    }
}
