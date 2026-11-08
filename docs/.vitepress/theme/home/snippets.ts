export const appSnippet = `
use tessera_components::{
    alignment::{CrossAxisAlignment, MainAxisAlignment},
    button::button,
    column::column,
    modifier::ModifierExt as _,
    surface::surface,
    text::text,
    theme::material_theme,
};
use tessera_ui::{Dp, Modifier, remember, tessera};

#[tessera]
pub fn app() {
    let count = remember(|| 0i32);

    material_theme().child(move || {
        surface()
            .modifier(Modifier::new().fill_max_size())
            .child(move || {
                column()
                    .modifier(Modifier::new().fill_max_size())
                    .main_axis_alignment(MainAxisAlignment::Center)
                    .cross_axis_alignment(CrossAxisAlignment::Center)
                    .children(move || {
                        text(count.get().to_string()).size(Dp(40.0));
                        button()
                            .filled()
                            .on_click(move || count.with_mut(|c| *c += 1))
                            .child(|| text("Increment"));
                    });
            });
    });
}
`;
