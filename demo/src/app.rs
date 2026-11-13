//! The live demo embedded on the Tessera homepage: a chat client in Material 3
//! Expressive style. Replies are scripted and stream in frame by frame; the
//! interface around them is real Tessera UI.

use tessera_components::{
    alignment::{Alignment, CrossAxisAlignment, MainAxisAlignment},
    boxed::boxed,
    button::button,
    chip::chip,
    column::column,
    flow_row::flow_row,
    icon::icon,
    icon_button::{IconButtonSize, IconButtonVariant, icon_button},
    lazy_list::{LazyListController, lazy_column},
    material_icons::filled,
    modifier::ModifierExt as _,
    row::row,
    shape_def::{RoundedCorner, Shape},
    spacer::spacer,
    surface::surface,
    text::text,
    text_field::text_field,
    text_input::TextInputController,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::{ClickableArgs, ModifierExt as _, Padding};
use tessera_i18n::{I18n, LanguageIdentifier};

use crate::res::I18N;
use tessera_ui::{
    Color, Dispatcher, Dp, LayoutCoordinates, Model, ModelInit, Modifier, State, Task, launch,
    modifier::FocusModifierExt as _, remember, spawn, tessera, use_context, with_frame_time,
};

/// Window size classes: below `COMPACT` the rail is hidden, below `EXPANDED`
/// it starts collapsed.
const COMPACT: f64 = 600.0;
const EXPANDED: f64 = 840.0;
const THREAD_WIDTH: Dp = Dp(720.0);
const CHARS_PER_SECOND: f32 = 90.0;

/// A scripted topic. Every field is a message key in `locales/*/chat.ftl`.
struct Topic {
    prompt: &'static str,
    title: &'static str,
    answer: &'static str,
    /// Words in any language that select this topic in a typed prompt.
    keywords: &'static [&'static str],
}

const DRAW: Topic = Topic {
    prompt: "prompt-draw",
    title: "title-draw",
    answer: "answer-draw",
    keywords: &["draw", "render", "绘制", "渲染", "画"],
};
const MODEL: Topic = Topic {
    prompt: "prompt-model",
    title: "title-model",
    answer: "answer-model",
    keywords: &["model", "state", "模型", "状态"],
};
const SHADER: Topic = Topic {
    prompt: "prompt-shader",
    title: "title-shader",
    answer: "answer-shader",
    keywords: &["shader", "wgsl", "着色器"],
};
const FAST: Topic = Topic {
    prompt: "prompt-fast",
    title: "title-fast",
    answer: "answer-fast",
    keywords: &["fast", "speed", "perf", "快", "性能"],
};
const TOPICS: [&Topic; 4] = [&DRAW, &MODEL, &SHADER, &FAST];
const SUGGESTIONS: [&Topic; 3] = [&DRAW, &MODEL, &SHADER];

fn query_param(name: &str) -> Option<String> {
    #[cfg(target_family = "wasm")]
    {
        let query = web_sys::window()?.location().search().ok()?;
        query.trim_start_matches('?').split('&').find_map(|pair| {
            let (key, value) = pair.split_once('=')?;
            (key == name).then(|| value.to_string())
        })
    }
    #[cfg(not(target_family = "wasm"))]
    {
        let _ = name;
        None
    }
}

/// The page passes `?theme=dark&lang=zh-CN` so the demo starts in the site's
/// theme and language; later changes arrive as messages.
fn starts_dark() -> bool {
    query_param("theme").as_deref() == Some("dark")
}

pub(crate) fn initial_language() -> Option<LanguageIdentifier> {
    query_param("lang")?.parse().ok()
}

/// The website's indigo, converted from sRGB to the linear seed Tessera expects.
fn seed() -> Color {
    let linear = |c: f32| c.powf(2.2);
    Color::from_rgb(
        linear(0x63 as f32 / 255.0),
        linear(0x66 as f32 / 255.0),
        linear(0xf1 as f32 / 255.0),
    )
}

/// Text that is either translated when shown or kept as the user typed it,
/// so switching languages retranslates the scripted parts of a conversation.
#[derive(Clone, PartialEq)]
enum Text {
    Key(&'static str),
    Typed(String),
}

impl Text {
    fn resolve(&self) -> String {
        match self {
            Text::Key(id) => I18N.text(id),
            Text::Typed(text) => text.clone(),
        }
    }
}

#[derive(Clone, PartialEq)]
enum Author {
    User,
    Assistant,
}

#[derive(Clone, PartialEq)]
struct Message {
    author: Author,
    text: Text,
    /// Characters revealed so far while the reply streams.
    shown: Option<usize>,
}

impl Message {
    fn new(author: Author, text: Text) -> Self {
        Self {
            author,
            text,
            shown: None,
        }
    }

    fn content(&self) -> String {
        let text = self.text.resolve();
        match self.shown {
            Some(shown) => text.chars().take(shown).collect(),
            None => text,
        }
    }
}

#[derive(Clone, PartialEq)]
struct Conversation {
    title: Text,
    messages: Vec<Message>,
}

impl Conversation {
    fn empty() -> Self {
        Self {
            title: Text::Key("chat-new"),
            messages: Vec::new(),
        }
    }

    fn about(topic: &Topic) -> Self {
        Self {
            title: Text::Key(topic.title),
            messages: vec![
                Message::new(Author::User, Text::Key(topic.prompt)),
                Message::new(Author::Assistant, Text::Key(topic.answer)),
            ],
        }
    }
}

fn answer_for(prompt: &str) -> &'static str {
    let prompt = prompt.to_lowercase();
    TOPICS
        .iter()
        .find(|topic| topic.keywords.iter().any(|word| prompt.contains(word)))
        .map_or("answer-fallback", |topic| topic.answer)
}

struct Chat {
    conversations: State<Vec<Conversation>>,
    selected: State<usize>,
    streaming: State<bool>,
    reply: Option<Task>,
}

impl ModelInit for Chat {
    fn init() -> Self {
        Self {
            conversations: State::new(vec![
                Conversation::empty(),
                Conversation::about(&FAST),
                Conversation::about(&MODEL),
                Conversation::about(&SHADER),
            ]),
            selected: State::new(0),
            streaming: State::new(false),
            reply: None,
        }
    }
}

impl Chat {
    fn select(&mut self, index: usize) {
        self.stop();
        self.selected.set(index);
    }

    fn new_chat(&mut self) {
        self.stop();
        let empty = self
            .conversations
            .with(|all| all.iter().position(|c| c.messages.is_empty()));
        match empty {
            Some(index) => self.selected.set(index),
            None => {
                self.conversations
                    .with_mut(|all| all.insert(0, Conversation::empty()));
                self.selected.set(0);
            }
        }
    }

    fn stop(&mut self) {
        self.reply = None;
        self.streaming.set(false);
        let index = self.selected.get();
        // A stopped reply keeps what it showed.
        self.conversations.with_mut(|all| {
            for message in &mut all[index].messages {
                if message.shown.is_some() {
                    message.text = Text::Typed(message.content());
                    message.shown = None;
                }
            }
        });
    }

    fn ask(&mut self, topic: &Topic) {
        self.send(
            Text::Key(topic.prompt),
            Text::Key(topic.title),
            topic.answer,
        );
    }

    fn ask_typed(&mut self, prompt: String) {
        let prompt = prompt.trim().to_string();
        if prompt.is_empty() {
            return;
        }
        let title = if prompt.chars().count() > 20 {
            format!(
                "{}…",
                prompt.chars().take(19).collect::<String>().trim_end()
            )
        } else {
            prompt.clone()
        };
        let answer = answer_for(&prompt);
        self.send(Text::Typed(prompt), Text::Typed(title), answer);
    }

    fn send(&mut self, prompt: Text, title: Text, answer: &'static str) {
        if self.streaming.get() {
            return;
        }
        let index = self.selected.get();
        let conversations = self.conversations;
        let message = conversations.with_mut(|all| {
            let conversation = &mut all[index];
            if conversation.messages.is_empty() {
                conversation.title = title;
            }
            conversation
                .messages
                .push(Message::new(Author::User, prompt));
            conversation.messages.push(Message {
                author: Author::Assistant,
                text: Text::Key(answer),
                shown: Some(0),
            });
            conversation.messages.len() - 1
        });
        let streaming = self.streaming;
        streaming.set(true);
        // Reveal the answer a few characters per frame, in whatever language
        // is current. Replacing the task cancels a reply that is still
        // streaming.
        self.reply = Some(spawn(Dispatcher::Ui, async move {
            let start = with_frame_time(|time| time).await;
            loop {
                let elapsed = with_frame_time(move |time| time.duration_since(start)).await;
                let wanted = (elapsed.as_secs_f32() * CHARS_PER_SECOND) as usize;
                let done = wanted >= I18N.text(answer).chars().count();
                conversations.with_mut(|all| {
                    all[index].messages[message].shown = (!done).then_some(wanted);
                });
                if done {
                    break;
                }
            }
            streaming.set(false);
        }));
    }
}

/// What the homepage reports, as `{ source: "tessera-site", theme, lang }`.
#[cfg(target_family = "wasm")]
struct SiteUpdate {
    dark: Option<bool>,
    language: Option<LanguageIdentifier>,
}

/// Waits for the next message from the homepage.
#[cfg(target_family = "wasm")]
async fn next_update() -> Option<SiteUpdate> {
    use wasm_bindgen::JsCast as _;
    let window = web_sys::window()?;
    let message = js_sys::Promise::new(&mut |resolve, _reject| {
        let options = web_sys::AddEventListenerOptions::new();
        options.set_once(true);
        let _ = window.add_event_listener_with_callback_and_add_event_listener_options(
            "message", &resolve, &options,
        );
    });
    let event = wasm_bindgen_futures::JsFuture::from(message).await.ok()?;
    let data = event.dyn_into::<web_sys::MessageEvent>().ok()?.data();
    let field = |name: &str| js_sys::Reflect::get(&data, &name.into()).ok()?.as_string();
    (field("source")? == "tessera-site").then(|| SiteUpdate {
        dark: field("theme").map(|theme| theme == "dark"),
        language: field("lang").and_then(|lang| lang.parse().ok()),
    })
}

#[tessera]
pub fn app() {
    let dark = remember(starts_dark);
    // The task sleeps until a message arrives, so it costs no frames.
    #[cfg(target_family = "wasm")]
    tessera_ui::launch_once(async move {
        loop {
            let Some(update) = next_update().await else {
                continue;
            };
            if let Some(next) = update.dark {
                dark.set(next);
            }
            if let Some(language) = update.language {
                let i18n = I18n::current();
                if i18n.locale() != language {
                    i18n.set_locale(language);
                }
            }
        }
    });
    material_theme()
        .theme(move || MaterialTheme::from_seed(seed(), dark.get()))
        .child(chat_screen);
}
/// The demo's width before its first layout, so the panel starts in the
/// right state instead of animating on load.
fn initial_width() -> Dp {
    #[cfg(target_family = "wasm")]
    {
        web_sys::window()
            .and_then(|window| window.inner_width().ok())
            .and_then(|width| width.as_f64())
            .map_or(Dp(960.0), Dp)
    }
    #[cfg(not(target_family = "wasm"))]
    {
        Dp(960.0)
    }
}

const PANEL_WIDTH: f64 = 280.0;
const SLIDE_SECONDS: f32 = 0.35;

/// Moves `progress` to the open or closed position with an emphasized
/// deceleration, one step per frame.
async fn slide(progress: State<f32>, open: bool) {
    let from = progress.get();
    let to = if open { 1.0 } else { 0.0 };
    if from == to {
        return;
    }
    let start = with_frame_time(|time| time).await;
    loop {
        let t = with_frame_time(move |now| {
            (now.duration_since(start).as_secs_f32() / SLIDE_SECONDS).min(1.0)
        })
        .await;
        progress.set(from + (to - from) * (1.0 - (1.0 - t).powi(4)));
        if t >= 1.0 {
            break;
        }
    }
}

#[derive(Clone, Copy, PartialEq)]
struct Panel {
    open: bool,
    compact: bool,
    toggle: State<Option<bool>>,
}

impl Panel {
    fn set(self, open: bool) {
        self.toggle.set(Some(open));
    }
}

#[tessera]
fn chat_screen(model: Model<Chat>) {
    let scheme = use_context::<MaterialTheme>().unwrap().get().color_scheme;
    let width = remember(initial_width);
    // `None` follows the window width until the user opens or closes the panel.
    let toggle = remember(|| None::<bool>);
    let compact = width.get().0 < COMPACT;
    let open = toggle.get().unwrap_or(width.get().0 >= EXPANDED);
    let panel = Panel {
        open,
        compact,
        toggle,
    };
    let progress = remember(move || if open { 1.0f32 } else { 0.0 });
    launch(open, slide(progress, open));
    let shown = progress.get();

    boxed()
        .modifier(
            Modifier::new()
                .fill_max_size()
                .background(scheme.surface)
                .on_layout_coordinates(move |coordinates: LayoutCoordinates| {
                    let next = coordinates.local_size.width.to_dp();
                    if width.get() != next {
                        width.set(next);
                    }
                }),
        )
        .children(move || {
            row()
                .modifier(Modifier::new().fill_max_size())
                .children(move || {
                    if !compact && shown > 0.0 {
                        boxed()
                            .modifier(
                                Modifier::new()
                                    .width(Dp(PANEL_WIDTH * f64::from(shown)))
                                    .fill_max_height()
                                    .clip_to_bounds(),
                            )
                            .children(move || {
                                side_panel(panel).model(model);
                            });
                    }
                    let inset = if compact { Dp(0.0) } else { Dp(8.0) };
                    let left = if compact || shown > 0.0 {
                        Dp(0.0)
                    } else {
                        inset
                    };
                    surface()
                        .style(scheme.surface_container_lowest.into())
                        .shape(if compact {
                            Shape::RECTANGLE
                        } else {
                            Shape::rounded_rectangle(Dp(24.0))
                        })
                        .modifier(
                            Modifier::new()
                                .fill_max_height()
                                .weight(1.0)
                                .padding(Padding::new(left, inset, inset, inset)),
                        )
                        .child(move || {
                            column().modifier(Modifier::new().fill_max_size()).children(
                                move || {
                                    top_bar(panel, shown < 1.0 || compact).model(model);
                                    thread().model(model);
                                    composer().model(model);
                                },
                            );
                        });
                });

            // On narrow screens the panel slides over the chat, above a scrim.
            if compact && shown > 0.0 {
                spacer().modifier(
                    Modifier::new()
                        .fill_max_size()
                        .background(Color::BLACK.with_alpha(0.32 * shown))
                        .clickable(ClickableArgs {
                            on_click: tessera_ui::Callback::new(move || panel.set(false)),
                            ..Default::default()
                        }),
                );
                surface()
                    .style(scheme.surface_container_low.into())
                    .shape(Shape::RoundedRectangle {
                        top_left: RoundedCorner::manual(Dp(0.0), 3.0),
                        top_right: RoundedCorner::manual(Dp(28.0), 3.0),
                        bottom_right: RoundedCorner::manual(Dp(28.0), 3.0),
                        bottom_left: RoundedCorner::manual(Dp(0.0), 3.0),
                    })
                    .modifier(
                        Modifier::new()
                            .width(Dp(PANEL_WIDTH))
                            .fill_max_height()
                            .offset(Dp(-PANEL_WIDTH * f64::from(1.0 - shown)), Dp(0.0)),
                    )
                    .child(move || {
                        side_panel(panel).model(model);
                    });
            }
        });
}

/// The conversation list. Conversations are content rather than fixed
/// destinations, so this is a plain side panel instead of a navigation rail.
#[tessera]
fn side_panel(panel: Panel, model: Model<Chat>) {
    let theme = use_context::<MaterialTheme>().unwrap().get();
    let (conversations, selected) = model.with(|chat| (chat.conversations, chat.selected));
    column()
        .modifier(
            Modifier::new()
                .width(Dp(PANEL_WIDTH))
                .fill_max_height()
                .padding_all(Dp(12.0)),
        )
        .children(move || {
            icon_button()
                .variant(IconButtonVariant::Standard)
                .icon(filled::MENU_OPEN_SVG)
                .accessibility_label(I18N.text("sidebar-close"))
                .on_click(move || panel.set(false));
            spacer().modifier(Modifier::new().height(Dp(12.0)));
            button()
                .tonal()
                .on_click(move || {
                    model.with_mut(Chat::new_chat);
                    if panel.compact {
                        panel.set(false);
                    }
                })
                .child(|| {
                    row()
                        .cross_axis_alignment(CrossAxisAlignment::Center)
                        .children(|| {
                            icon().painter(filled::ADD_SVG).size(Dp(20.0));
                            spacer().modifier(Modifier::new().width(Dp(8.0)));
                            text(I18N.text("chat-new"));
                        });
                });
            spacer().modifier(Modifier::new().height(Dp(24.0)));
            text(I18N.text("chat-recent"))
                .style(theme.typography.label_medium)
                .color(theme.color_scheme.on_surface_variant)
                .modifier(Modifier::new().padding_symmetric(Dp(16.0), Dp(8.0)));
            let titles =
                conversations.with(|all| all.iter().map(|c| c.title.resolve()).collect::<Vec<_>>());
            let current = selected.get();
            for (index, title) in titles.into_iter().enumerate() {
                conversation_item(title, index == current).on_click(move || {
                    model.with_mut(|chat| chat.select(index));
                    if panel.compact {
                        panel.set(false);
                    }
                });
            }
        });
}

#[tessera]
fn conversation_item(
    #[prop(into)] title: String,
    selected: bool,
    on_click: Option<tessera_ui::Callback>,
) {
    let theme = use_context::<MaterialTheme>().unwrap().get();
    let scheme = theme.color_scheme;
    let (color, ink) = if selected {
        (scheme.secondary_container, scheme.on_secondary_container)
    } else {
        (Color::TRANSPARENT, scheme.on_surface_variant)
    };
    let mut item = surface()
        .style(color.into())
        .shape(Shape::CAPSULE)
        .modifier(Modifier::new().fill_max_width().height(Dp(48.0)));
    if let Some(on_click) = on_click {
        item = item.on_click_shared(on_click);
    }
    item.child(move || {
        boxed()
            .alignment(Alignment::CenterStart)
            .modifier(
                Modifier::new()
                    .fill_max_size()
                    .padding_symmetric(Dp(16.0), Dp(0.0)),
            )
            .children({
                let title = title.clone();
                move || {
                    text(title.clone())
                        .style(theme.typography.label_large)
                        .color(ink);
                }
            });
    });
}

#[tessera]
fn top_bar(panel: Panel, show_toggle: bool, model: Model<Chat>) {
    let theme = use_context::<MaterialTheme>().unwrap().get();
    let (conversations, selected) = model.with(|chat| (chat.conversations, chat.selected));
    let title = conversations.with(|all| all[selected.get()].title.resolve());
    row()
        .modifier(
            Modifier::new()
                .fill_max_width()
                .height(Dp(64.0))
                .padding_symmetric(Dp(12.0), Dp(0.0)),
        )
        .cross_axis_alignment(CrossAxisAlignment::Center)
        .children(move || {
            if show_toggle {
                icon_button()
                    .variant(IconButtonVariant::Standard)
                    .icon(filled::MENU_SVG)
                    .accessibility_label(I18N.text("sidebar-open"))
                    .on_click(move || panel.set(true));
                icon_button()
                    .variant(IconButtonVariant::Standard)
                    .icon(filled::ADD_SVG)
                    .accessibility_label(I18N.text("chat-new"))
                    .on_click(move || model.with_mut(Chat::new_chat));
            }
            text(title.clone())
                .style(theme.typography.title_medium)
                .modifier(
                    Modifier::new()
                        .weight(1.0)
                        .padding_symmetric(Dp(12.0), Dp(0.0)),
                );
        });
}
/// Centers content at reading width inside a full-width parent, so the list
/// and its scrollbar can span the whole pane.
fn reading_width() -> Modifier {
    Modifier::new()
        .size_in(None, Some(THREAD_WIDTH), None, None)
        .fill_max_width()
}

#[tessera]
fn thread(model: Model<Chat>) {
    let (conversations, selected, streaming) =
        model.with(|chat| (chat.conversations, chat.selected, chat.streaming));
    let index = selected.get();
    let messages = conversations.with(|all| all[index].messages.clone());
    let list = remember(LazyListController::new);
    let height = remember(|| Dp(400.0));

    // Follow the newest text: scroll whenever the conversation or the length
    // of its last message changes.
    let last_len = messages.last().map_or(0, |m| m.content().len());
    let anchor = messages.len();
    launch((index, anchor, last_len), async move {
        let offset = Dp((height.get().0 - 24.0).max(0.0));
        list.with_mut(|list| list.scroll_to_item(anchor, offset));
    });

    boxed()
        .alignment(Alignment::TopCenter)
        .modifier(Modifier::new().fill_max_width().weight(1.0))
        .children(move || {
            if messages.is_empty() {
                empty_state().model(model);
                return;
            }
            let messages = messages.clone();
            let count = messages.len();
            lazy_column()
                .modifier(Modifier::new().fill_max_size().on_layout_coordinates(
                    move |coordinates: LayoutCoordinates| {
                        let next = coordinates.local_size.height.to_dp();
                        if height.get() != next {
                            height.set(next);
                        }
                    },
                ))
                .controller(list)
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .content_padding(Dp(24.0))
                .item_spacing(Dp(24.0))
                // Items span the whole pane, so the scrollbar sits at its edge;
                // each centers its content at reading width.
                .items(count + 1, move |index| {
                    let message = messages.get(index).cloned();
                    boxed()
                        .alignment(Alignment::TopCenter)
                        .modifier(Modifier::new().fill_max_width())
                        .children(move || match &message {
                            Some(message) => {
                                let typing = streaming.get() && index + 1 == count;
                                bubble(message.content(), message.author == Author::User, typing);
                            }
                            None => {
                                spacer().modifier(Modifier::new().height(Dp(8.0)));
                            }
                        });
                });
        });
}

#[tessera]
fn bubble(#[prop(into)] content: String, from_user: bool, typing: bool) {
    let theme = use_context::<MaterialTheme>().unwrap().get();
    let scheme = theme.color_scheme.clone();
    let body = theme.typography.body_large;
    if from_user {
        row()
            .modifier(reading_width())
            .main_axis_alignment(MainAxisAlignment::End)
            .children(move || {
                let content = content.clone();
                surface()
                    .style(scheme.surface_container_high.into())
                    .shape(Shape::rounded_rectangle(Dp(24.0)))
                    .modifier(Modifier::new().size_in(None, Some(Dp(480.0)), None, None))
                    .child(move || {
                        text(content.clone())
                            .style(body)
                            .color(scheme.on_surface)
                            .modifier(Modifier::new().padding_symmetric(Dp(20.0), Dp(12.0)));
                    });
            });
    } else {
        let shown = if typing {
            format!("{content}▍")
        } else {
            content
        };
        text(shown)
            .style(body)
            .color(scheme.on_surface)
            .modifier(reading_width());
    }
}

#[tessera]
fn empty_state(model: Model<Chat>) {
    let theme = use_context::<MaterialTheme>().unwrap().get();
    column()
        .modifier(
            Modifier::new()
                .size_in(None, Some(THREAD_WIDTH), None, None)
                .fill_max_size()
                .padding_all(Dp(24.0)),
        )
        .main_axis_alignment(MainAxisAlignment::Center)
        .cross_axis_alignment(CrossAxisAlignment::Center)
        .children(move || {
            text(I18N.text("chat-empty")).style(theme.typography.emphasized().headline_medium);
            spacer().modifier(Modifier::new().height(Dp(24.0)));
            flow_row()
                .item_spacing(Dp(8.0))
                .line_spacing(Dp(8.0))
                .children(move || {
                    for topic in SUGGESTIONS {
                        chip()
                            .assist(I18N.text(topic.prompt))
                            .on_click(move || model.with_mut(|chat| chat.ask(topic)));
                    }
                });
        });
}

#[tessera]
fn composer(model: Model<Chat>) {
    let scheme = use_context::<MaterialTheme>().unwrap().get().color_scheme;
    let streaming = model.with(|chat| chat.streaming);
    let input = remember(|| TextInputController::new(Dp(16.0), None));
    let submit = move || {
        let prompt = input.with(TextInputController::text);
        if prompt.trim().is_empty() || streaming.get() {
            return;
        }
        input.with_mut(|input| input.set_text(""));
        model.with_mut(|chat| chat.ask_typed(prompt));
    };
    boxed()
        .alignment(Alignment::TopCenter)
        .modifier(Modifier::new().fill_max_width().padding_all(Dp(16.0)))
        .children(move || {
            surface()
                .style(scheme.surface_container_high.into())
                .shape(Shape::CAPSULE)
                .modifier(reading_width())
                .child(move || {
                    row()
                        .modifier(Modifier::new().fill_max_width().padding_all(Dp(8.0)))
                        .cross_axis_alignment(CrossAxisAlignment::Center)
                        .children(move || {
                            boxed()
                                .modifier(Modifier::new().weight(1.0))
                                .children(move || {
                                    text_field()
                                        .controller(input)
                                        .placeholder(I18N.text("chat-placeholder"))
                                        .accessibility_label(I18N.text("chat-message"))
                                        .show_indicator(false)
                                        .background_color(Color::TRANSPARENT)
                                        .focus_background_color(Color::TRANSPARENT)
                                        .modifier(Modifier::new().fill_max_width())
                                        .on_submit(submit);
                                });
                            spacer().modifier(Modifier::new().width(Dp(8.0)));
                            if streaming.get() {
                                icon_button()
                                    .size(IconButtonSize::Medium)
                                    .icon(filled::STOP_SVG)
                                    .accessibility_label(I18N.text("chat-stop"))
                                    .on_click(move || model.with_mut(Chat::stop));
                            } else {
                                icon_button()
                                    .size(IconButtonSize::Medium)
                                    .icon(filled::ARROW_UPWARD_SVG)
                                    .accessibility_label(I18N.text("chat-send"))
                                    .on_click(submit);
                            }
                        });
                });
        });
}
