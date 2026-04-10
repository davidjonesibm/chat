import UIKit

/// Forces iOS to pre-load the keyboard subsystem so the first
/// TextField focus doesn't incur a multi-second delay.
enum KeyboardWarmer {
    @MainActor
    static func warmUp() {
        let window = UIApplication.shared
            .connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?
            .windows
            .first
        guard let window else { return }

        let field = UITextField(frame: .zero)
        window.addSubview(field)
        field.becomeFirstResponder()
        field.resignFirstResponder()
        field.removeFromSuperview()
    }
}
