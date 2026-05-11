import SwiftUI

struct RootView: View {
    @EnvironmentObject private var viewModel: AppViewModel

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.member == nil {
                    AuthenticationView()
                } else {
                    switch viewModel.selectedRole {
                    case .parent:
                        ParentDashboardView()
                    case .child:
                        ChildHomeView()
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if viewModel.member != nil {
                        Picker("Mode", selection: $viewModel.selectedRole) {
                            Text("Parent").tag(FamilyRole.parent)
                            Text("Child").tag(FamilyRole.child)
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 180)
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                StatusBannerView()
            }
        }
    }
}
