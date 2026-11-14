const $ = selector => document.querySelector(selector);

export function initMersalCommunities({ supabase, getCurrentUser, announce, safeText }) {
  const panel = $("#communities-panel");
  const openButton = $("#open-communities-button");
  const closeButton = $("#communities-close");
  const home = $("#communities-home-view");
  const createView = $("#communities-create-view");
  const detailView = $("#community-detail-view");
  const title = $("#communities-title");
  const intro = $("#communities-intro");
  const search = $("#communities-search");
  const list = $("#communities-list");
  const createButton = $("#community-create-button");
  const createForm = $("#community-create-form");
  const nameInput = $("#community-name-input");
  const descriptionInput = $("#community-description-input");
  const createSave = $("#community-create-save");
  const createCancel = $("#community-create-cancel");
  const detailBack = $("#community-detail-back");
  const detailName = $("#community-detail-name");
  const detailDescription = $("#community-detail-description");
  const joinButton = $("#community-join-toggle");
  const deleteButton = $("#community-delete-button");
  const postForm = $("#community-post-form");
  const postInput = $("#community-post-input");
  const postsList = $("#community-posts");
  const status = $("#communities-status");

  let communities = [];
  let activeCommunity = null;
  let isMember = false;
  let returnFocus = null;
  let busy = false;
  let realtimeChannel = null;

  const en = () => document.documentElement.lang === "en";
  const t = (ar, english) => en() ? english : ar;

  function localize() {
    const setText = (node, ar, english) => { if (node) node.textContent = en() ? english : ar; };
    const setAttr = (node, name, ar, english) => { if (node) node.setAttribute(name, en() ? english : ar); };
    setText(title, "المجتمعات", "Communities");
    setText(intro, "انضم إلى مجتمعات عامة وتابع إعلاناتها، أو أنشئ مجتمعك الخاص.", "Join public communities and follow their announcements, or create your own.");
    setText(createButton, "إنشاء مجتمع", "Create community");
    setText(closeButton, "إغلاق", "Close");
    setText($("#communities-create-title"), "إنشاء مجتمع", "Create community");
    setText(createSave, "حفظ المجتمع", "Save community");
    setText(createCancel, "إلغاء", "Cancel");
    setText(detailBack, "العودة إلى المجتمعات", "Back to communities");
    setText($("#community-post-form label"), "إعلان جديد", "New announcement");
    setText($("#community-post-submit"), "نشر الإعلان", "Publish announcement");
    setText(deleteButton, "حذف المجتمع", "Delete community");
    setText($("#community-create-form label[for='community-name-input']"), "اسم المجتمع", "Community name");
    setText($("#community-create-form label[for='community-description-input']"), "وصف المجتمع", "Community description");
    setAttr(panel, "aria-label", "المجتمعات", "Communities");
    setAttr(closeButton, "aria-label", "إغلاق المجتمعات", "Close communities");
    setAttr(search, "aria-label", "البحث في المجتمعات", "Search communities");
    setAttr(nameInput, "aria-label", "اسم المجتمع", "Community name");
    setAttr(descriptionInput, "aria-label", "وصف المجتمع", "Community description");
    setAttr(postInput, "aria-label", "اكتب إعلان المجتمع", "Write a community announcement");
    setAttr(list, "aria-label", "المجتمعات العامة", "Public communities");
    setAttr(postsList, "aria-label", "إعلانات المجتمع", "Community announcements");
    if (search) search.placeholder = t("ابحث عن مجتمع", "Search communities");
    if (nameInput) nameInput.placeholder = t("اسم المجتمع", "Community name");
    if (descriptionInput) descriptionInput.placeholder = t("وصف مختصر للمجتمع", "A short community description");
    if (postInput) postInput.placeholder = t("اكتب إعلانًا لأعضاء المجتمع", "Write an announcement for community members");
    if (activeCommunity) {
      joinButton.textContent = isMember ? t("مغادرة المجتمع", "Leave community") : t("الانضمام إلى المجتمع", "Join community");
      joinButton.setAttribute("aria-label", joinButton.textContent);
      joinButton.setAttribute("aria-pressed", String(isMember));
    }
  }

  const languageObserver = new MutationObserver(records => {
    if (records.some(record => record.attributeName === "lang")) {
      localize();
      if (!panel.hidden && !detailView.hidden && activeCommunity) void renderPosts(activeCommunity.id);
      else if (!panel.hidden && !home.hidden) renderList();
    }
  });
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  function setStatus(ar, english, error = false) {
    status.textContent = t(ar, english);
    status.setAttribute("role", error ? "alert" : "status");
  }

  async function stopRealtime() {
    if (!realtimeChannel) return;
    const channel = realtimeChannel;
    realtimeChannel = null;
    await supabase.removeChannel(channel);
  }

  async function startRealtime(communityId) {
    await stopRealtime();
    realtimeChannel = supabase.channel("mersal-community-posts-" + communityId)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "community_posts", filter: "community_id=eq." + communityId
      }, () => {
        if (activeCommunity?.id === communityId && !detailView.hidden) void renderPosts(communityId);
      })
      .subscribe();
  }

  async function loadCommunities() {
    const user = getCurrentUser();
    if (!user) return;
    setStatus("جارٍ تحميل المجتمعات…", "Loading communities…");
    const [communityResult, memberResult] = await Promise.all([
      supabase.from("communities").select("id,owner_id,name,description,created_at,updated_at")
        .eq("is_public", true).order("updated_at", { ascending: false }).limit(100),
      supabase.from("community_members").select("community_id").eq("user_id", user.id)
    ]);
    if (communityResult.error) throw communityResult.error;
    if (memberResult.error) throw memberResult.error;
    const memberIds = new Set((memberResult.data || []).map(row => row.community_id));
    communities = (communityResult.data || []).map(row => ({
      ...row, member: memberIds.has(row.id), owned: row.owner_id === user.id
    }));
    renderList();
    setStatus(communities.length ? "" : "لا توجد مجتمعات عامة بعد.", "No public communities yet.");
  }

  function renderList() {
    const query = (search.value || "").trim().toLocaleLowerCase();
    const filtered = communities.filter(item => (item.name + " " + (item.description || "")).toLocaleLowerCase().includes(query));
    list.replaceChildren();
    if (!filtered.length) {
      list.append(safeText("li", "empty-item", t("لا توجد مجتمعات مطابقة.", "No matching communities.")));
      return;
    }
    for (const community of filtered) {
      const item = document.createElement("li");
      item.className = "community-list-item";
      const open = safeText("button", "community-open-button", community.name);
      open.type = "button";
      open.setAttribute("aria-label", t("فتح مجتمع ", "Open community ") + community.name);
      open.setAttribute("data-no-translate", "");
      const description = safeText("p", "community-list-description", community.description || t("لا يوجد وصف للمجتمع.", "No community description."));
      description.setAttribute("data-no-translate", "");
      const meta = safeText("span", "community-list-meta", community.owned ? t("مجتمعك", "Your community") : community.member ? t("أنت عضو", "You are a member") : t("مجتمع عام", "Public community"));
      open.addEventListener("click", () => { void openCommunity(community); });
      item.append(open, description, meta);
      list.append(item);
    }
  }

  function showHome() {
    void stopRealtime();
    activeCommunity = null;
    isMember = false;
    createView.hidden = true;
    detailView.hidden = true;
    home.hidden = false;
    localize();
  }

  function open(returnElement = openButton) {
    if (!getCurrentUser() || !panel) return;
    returnFocus = returnElement || openButton;
    panel.hidden = false;
    showHome();
    void loadCommunities().catch(error => setStatus("تعذر تحميل المجتمعات: " + (error.message || ""), "Could not load communities: " + (error.message || ""), true));
    closeButton.focus();
  }

  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    showHome();
    if (returnFocus?.isConnected) returnFocus.focus();
    else openButton?.focus();
  }

  async function openCommunity(community) {
    const user = getCurrentUser();
    activeCommunity = community;
    const membership = await supabase.from("community_members").select("community_id")
      .eq("community_id", community.id).eq("user_id", user.id).maybeSingle();
    if (membership.error) {
      announce(t("تعذر فتح المجتمع: ", "Could not open community: ") + membership.error.message, "error");
      return;
    }
    isMember = Boolean(membership.data);
    home.hidden = true;
    createView.hidden = true;
    detailView.hidden = false;
    detailName.textContent = community.name;
    detailName.setAttribute("data-no-translate", "");
    detailDescription.textContent = community.description || t("لا يوجد وصف للمجتمع.", "No community description.");
    detailDescription.setAttribute("data-no-translate", "");
    const own = community.owner_id === user.id;
    joinButton.hidden = own;
    deleteButton.hidden = !own;
    postForm.hidden = !own;
    localize();
    await renderPosts(community.id);
    void startRealtime(community.id);
    detailBack.focus();
  }

  async function renderPosts(communityId) {
    const result = await supabase.from("community_posts")
      .select("id,community_id,author_id,body,created_at,edited_at,is_deleted")
      .eq("community_id", communityId).order("created_at", { ascending: false }).limit(100);
    if (result.error) {
      postsList.replaceChildren(safeText("li", "empty-item", t("تعذر تحميل إعلانات المجتمع.", "Could not load community announcements.")));
      return;
    }
    postsList.replaceChildren();
    if (!result.data?.length) {
      postsList.append(safeText("li", "empty-item", t("لا توجد إعلانات في هذا المجتمع بعد.", "No announcements in this community yet.")));
      return;
    }
    for (const post of result.data) {
      const item = document.createElement("li");
      item.className = "community-post-item";
      const body = safeText("p", "community-post-body", post.is_deleted ? t("حذف مالك المجتمع هذا الإعلان.", "The community owner deleted this announcement.") : post.body);
      body.setAttribute("data-no-translate", "");
      const time = safeText("time", "community-post-time", new Intl.DateTimeFormat(en() ? "en" : "ar-JO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.created_at)));
      item.append(body, time);
      if (post.edited_at && !post.is_deleted) item.append(safeText("span", "community-post-edited", t("تم التعديل", "Edited")));
      if (activeCommunity?.owner_id === getCurrentUser()?.id && !post.is_deleted) {
        const actions = document.createElement("div");
        actions.className = "community-post-actions";
        const edit = safeText("button", "quiet-button", t("تعديل", "Edit"));
        edit.type = "button";
        edit.addEventListener("click", async () => {
          const value = window.prompt(t("تعديل إعلان المجتمع", "Edit community announcement"), post.body);
          if (value === null) return;
          const bodyValue = value.trim();
          if (!bodyValue || bodyValue.length > 5000) {
            announce(t("يجب أن يكون الإعلان من حرف واحد إلى 5000 حرف.", "The announcement must contain 1 to 5000 characters."), "error");
            return;
          }
          edit.disabled = true;
          const update = await supabase.from("community_posts").update({ body: bodyValue, edited_at: new Date().toISOString() })
            .eq("id", post.id).eq("community_id", communityId);
          if (update.error) {
            edit.disabled = false;
            announce(t("تعذر تعديل الإعلان: ", "Could not edit announcement: ") + update.error.message, "error");
            return;
          }
          await renderPosts(communityId);
          announce(t("تم تعديل الإعلان.", "Announcement edited."));
        });
        const remove = safeText("button", "danger-button", t("حذف", "Delete"));
        remove.type = "button";
        remove.addEventListener("click", async () => {
          if (!window.confirm(t("هل تريد حذف هذا الإعلان؟", "Delete this announcement?"))) return;
          remove.disabled = true;
          const update = await supabase.from("community_posts").update({ is_deleted: true })
            .eq("id", post.id).eq("community_id", communityId);
          if (update.error) {
            remove.disabled = false;
            announce(t("تعذر حذف الإعلان: ", "Could not delete announcement: ") + update.error.message, "error");
            return;
          }
          await renderPosts(communityId);
          announce(t("تم حذف الإعلان.", "Announcement deleted."));
        });
        actions.append(edit, remove);
        item.append(actions);
      }
      postsList.append(item);
    }
  }

  createButton.addEventListener("click", () => {
    nameInput.value = "";
    descriptionInput.value = "";
    home.hidden = true;
    detailView.hidden = true;
    createView.hidden = false;
    localize();
    nameInput.focus();
  });

  createCancel.addEventListener("click", () => {
    showHome();
    createButton.focus();
  });

  createForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const user = getCurrentUser();
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    if (!name || name.length > 80 || description.length > 500) {
      announce(t("اسم المجتمع مطلوب حتى 80 حرفًا، والوصف حتى 500 حرف.", "A community name is required (up to 80 characters); description is limited to 500."), "error");
      nameInput.focus();
      return;
    }
    busy = true;
    createSave.disabled = true;
    const result = await supabase.from("communities").insert({ owner_id: user.id, name, description, is_public: true })
      .select("id,owner_id,name,description,created_at,updated_at").single();
    busy = false;
    createSave.disabled = false;
    if (result.error) {
      announce(t("تعذر إنشاء المجتمع: ", "Could not create community: ") + result.error.message, "error");
      return;
    }
    communities.unshift({ ...result.data, member: false, owned: true });
    showHome();
    renderList();
    announce(t("تم إنشاء المجتمع.", "Community created."));
    await openCommunity(result.data);
  });

  joinButton.addEventListener("click", async () => {
    if (!activeCommunity || busy) return;
    busy = true;
    joinButton.disabled = true;
    const user = getCurrentUser();
    const result = isMember
      ? await supabase.from("community_members").delete().eq("community_id", activeCommunity.id).eq("user_id", user.id)
      : await supabase.from("community_members").insert({ community_id: activeCommunity.id, user_id: user.id });
    joinButton.disabled = false;
    busy = false;
    if (result.error) {
      announce(t("تعذر تحديث عضوية المجتمع: ", "Could not update community membership: ") + result.error.message, "error");
      return;
    }
    isMember = !isMember;
    const index = communities.findIndex(row => row.id === activeCommunity.id);
    if (index >= 0) communities[index].member = isMember;
    localize();
    renderList();
    await renderPosts(activeCommunity.id);
    announce(isMember ? t("انضممت إلى المجتمع.", "You joined the community.") : t("غادرت المجتمع.", "You left the community."));
  });

  postForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!activeCommunity || activeCommunity.owner_id !== getCurrentUser()?.id || busy) return;
    const body = postInput.value.trim();
    if (!body || body.length > 5000) {
      announce(t("اكتب إعلانًا من حرف واحد إلى 5000 حرف.", "Write an announcement between 1 and 5000 characters."), "error");
      postInput.focus();
      return;
    }
    busy = true;
    $("#community-post-submit").disabled = true;
    const result = await supabase.from("community_posts").insert({
      community_id: activeCommunity.id, author_id: getCurrentUser().id, body
    });
    busy = false;
    $("#community-post-submit").disabled = false;
    if (result.error) {
      announce(t("تعذر نشر الإعلان: ", "Could not publish announcement: ") + result.error.message, "error");
      return;
    }
    postInput.value = "";
    await renderPosts(activeCommunity.id);
    announce(t("تم نشر الإعلان.", "Announcement published."));
  });

  deleteButton.addEventListener("click", async () => {
    if (!activeCommunity || activeCommunity.owner_id !== getCurrentUser()?.id || busy) return;
    if (!window.confirm(t("حذف المجتمع سيحذف عضوياته وإعلاناته. هل تريد المتابعة؟", "Deleting this community also deletes its memberships and announcements. Continue?"))) return;
    busy = true;
    deleteButton.disabled = true;
    const result = await supabase.from("communities").delete().eq("id", activeCommunity.id).eq("owner_id", getCurrentUser().id);
    deleteButton.disabled = false;
    busy = false;
    if (result.error) {
      announce(t("تعذر حذف المجتمع: ", "Could not delete community: ") + result.error.message, "error");
      return;
    }
    activeCommunity = null;
    showHome();
    await loadCommunities();
    announce(t("تم حذف المجتمع.", "Community deleted."));
    createButton.focus();
  });

  detailBack.addEventListener("click", () => {
    showHome();
    renderList();
    title.focus();
  });
  search.addEventListener("input", renderList);
  closeButton.addEventListener("click", close);
  panel.addEventListener("click", event => { if (event.target === panel) close(); });
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!createView.hidden) { showHome(); createButton.focus(); }
      else if (!detailView.hidden) { showHome(); title.focus(); }
      else close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]):not([hidden]),textarea:not([disabled]):not([hidden]),[tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.closest("[hidden]") && element.getClientRects().length);
    if (!focusable.length) { event.preventDefault(); closeButton.focus(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  localize();
  return { open, close };
}
