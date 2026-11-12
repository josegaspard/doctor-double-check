import json
KEYS = ["errMembersRequired","errNameRequired","errOnlyResidents","errOnlyAdmins","errNotMember","errGeneric",
"search","newGroup","noMatch","empty","tag","member","members","noMessagesYet","resident","pickGroup","residentGroup",
"membersButton","membersAria","emptyThread","messagePlaceholder","send","searchResident","noResidents","selectedOne",
"selectedMany","created","createTitle","createDescription","namePlaceholder","nameLabel","cancel","create",
"pickGroupMembers","addedOne","addedMany","renamed","leave","leaveDescription","left","newNameLabel","save","rename",
"you","admin","add","addResidents"]
UI = ["fullscreen","document","viewersAvgWatched"]
D = {
"es": [
"Elige al menos un residente para el grupo.","Ponle un nombre al grupo.","Los grupos son solo entre residentes.",
"Solo quien administra el grupo puede cambiar el nombre.","Ya no perteneces a este grupo.","No se pudo completar. Inténtalo de nuevo.",
"Buscar grupo","Nuevo grupo","Ningún grupo coincide con la búsqueda.","Todavía no estás en ningún grupo. Crea uno con otros residentes para conversar.",
"Grupo","miembro","miembros","Sin mensajes todavía","Residente","Elige un grupo para ver la conversación o crea uno nuevo con otros residentes.",
"grupo de residentes","Miembros","Miembros del grupo","Aún no hay mensajes. Escribe el primero.","Escribe un mensaje al grupo","Enviar",
"Buscar residente por nombre","No hay residentes para agregar.","seleccionado","seleccionados","Grupo creado","Nuevo grupo de residentes",
"Ponle nombre y elige con qué residentes quieres conversar.","Nombre del grupo (ej. Guardia R1 Medicina Interna)","Nombre del grupo",
"Cancelar","Crear grupo","Elige un grupo para ver sus miembros.","Residente agregado","{n} residentes agregados","Nombre actualizado",
"Salir del grupo","Dejarás de ver los mensajes de este grupo. Alguien del grupo puede volver a agregarte.","Saliste del grupo",
"Nuevo nombre del grupo","Guardar","Cambiar nombre","Tú","Admin","Agregar","Agregar residentes"],
"en": [
"Choose at least one resident for the group.","Give the group a name.","Groups are only between residents.",
"Only the group admin can change the name.","You are no longer a member of this group.","Could not complete. Please try again.",
"Search group","New group","No group matches your search.","You are not in any group yet. Create one with other residents to chat.",
"Group","member","members","No messages yet","Resident","Choose a group to see the conversation or create a new one with other residents.",
"resident group","Members","Group members","No messages yet. Write the first one.","Write a message to the group","Send",
"Search resident by name","No residents to add.","selected","selected","Group created","New resident group",
"Name it and choose which residents you want to talk with.","Group name (e.g. R1 Internal Medicine on-call)","Group name",
"Cancel","Create group","Choose a group to see its members.","Resident added","{n} residents added","Name updated",
"Leave group","You will stop seeing this group's messages. Someone in the group can add you back.","You left the group",
"New group name","Save","Rename","You","Admin","Add","Add residents"],
"pt": [
"Escolha pelo menos um residente para o grupo.","Dê um nome ao grupo.","Os grupos são só entre residentes.",
"Só quem administra o grupo pode mudar o nome.","Você não faz mais parte deste grupo.","Não foi possível concluir. Tente novamente.",
"Buscar grupo","Novo grupo","Nenhum grupo corresponde à busca.","Você ainda não está em nenhum grupo. Crie um com outros residentes para conversar.",
"Grupo","membro","membros","Ainda sem mensagens","Residente","Escolha um grupo para ver a conversa ou crie um novo com outros residentes.",
"grupo de residentes","Membros","Membros do grupo","Ainda não há mensagens. Escreva a primeira.","Escreva uma mensagem para o grupo","Enviar",
"Buscar residente pelo nome","Não há residentes para adicionar.","selecionado","selecionados","Grupo criado","Novo grupo de residentes",
"Dê um nome e escolha com quais residentes quer conversar.","Nome do grupo (ex.: Plantão R1 Clínica Médica)","Nome do grupo",
"Cancelar","Criar grupo","Escolha um grupo para ver seus membros.","Residente adicionado","{n} residentes adicionados","Nome atualizado",
"Sair do grupo","Você deixará de ver as mensagens deste grupo. Alguém do grupo pode adicioná-lo de novo.","Você saiu do grupo",
"Novo nome do grupo","Salvar","Mudar nome","Você","Admin","Adicionar","Adicionar residentes"],
"fr": [
"Choisissez au moins un résident pour le groupe.","Donnez un nom au groupe.","Les groupes sont réservés aux résidents.",
"Seul l'administrateur du groupe peut changer le nom.","Vous ne faites plus partie de ce groupe.","Action impossible. Réessayez.",
"Rechercher un groupe","Nouveau groupe","Aucun groupe ne correspond à la recherche.","Vous n'êtes encore dans aucun groupe. Créez-en un avec d'autres résidents pour discuter.",
"Groupe","membre","membres","Pas encore de messages","Résident","Choisissez un groupe pour voir la conversation ou créez-en un avec d'autres résidents.",
"groupe de résidents","Membres","Membres du groupe","Aucun message pour l'instant. Écrivez le premier.","Écrivez un message au groupe","Envoyer",
"Rechercher un résident par nom","Aucun résident à ajouter.","sélectionné","sélectionnés","Groupe créé","Nouveau groupe de résidents",
"Donnez-lui un nom et choisissez avec quels résidents vous voulez discuter.","Nom du groupe (ex. Garde R1 Médecine interne)","Nom du groupe",
"Annuler","Créer le groupe","Choisissez un groupe pour voir ses membres.","Résident ajouté","{n} résidents ajoutés","Nom mis à jour",
"Quitter le groupe","Vous ne verrez plus les messages de ce groupe. Un membre du groupe pourra vous ajouter à nouveau.","Vous avez quitté le groupe",
"Nouveau nom du groupe","Enregistrer","Renommer","Vous","Admin","Ajouter","Ajouter des résidents"],
"it": [
"Scegli almeno un medico specializzando per il gruppo.","Dai un nome al gruppo.","I gruppi sono solo tra specializzandi.",
"Solo chi amministra il gruppo può cambiarne il nome.","Non fai più parte di questo gruppo.","Impossibile completare. Riprova.",
"Cerca gruppo","Nuovo gruppo","Nessun gruppo corrisponde alla ricerca.","Non sei ancora in nessun gruppo. Creane uno con altri specializzandi per conversare.",
"Gruppo","membro","membri","Ancora nessun messaggio","Specializzando","Scegli un gruppo per vedere la conversazione o creane uno nuovo con altri specializzandi.",
"gruppo di specializzandi","Membri","Membri del gruppo","Ancora nessun messaggio. Scrivi il primo.","Scrivi un messaggio al gruppo","Invia",
"Cerca specializzando per nome","Nessuno specializzando da aggiungere.","selezionato","selezionati","Gruppo creato","Nuovo gruppo di specializzandi",
"Dagli un nome e scegli con quali specializzandi vuoi conversare.","Nome del gruppo (es. Guardia R1 Medicina interna)","Nome del gruppo",
"Annulla","Crea gruppo","Scegli un gruppo per vedere i suoi membri.","Specializzando aggiunto","{n} specializzandi aggiunti","Nome aggiornato",
"Esci dal gruppo","Non vedrai più i messaggi di questo gruppo. Qualcuno del gruppo potrà aggiungerti di nuovo.","Sei uscito dal gruppo",
"Nuovo nome del gruppo","Salva","Cambia nome","Tu","Admin","Aggiungi","Aggiungi specializzandi"],
"de": [
"Wählen Sie mindestens eine Assistenzärztin oder einen Assistenzarzt für die Gruppe.","Geben Sie der Gruppe einen Namen.","Gruppen gibt es nur unter Assistenzärzten.",
"Nur wer die Gruppe verwaltet, kann den Namen ändern.","Sie gehören dieser Gruppe nicht mehr an.","Das hat nicht geklappt. Bitte erneut versuchen.",
"Gruppe suchen","Neue Gruppe","Keine Gruppe passt zur Suche.","Sie sind noch in keiner Gruppe. Erstellen Sie eine mit anderen Assistenzärzten, um zu chatten.",
"Gruppe","Mitglied","Mitglieder","Noch keine Nachrichten","Assistenzarzt","Wählen Sie eine Gruppe, um die Unterhaltung zu sehen, oder erstellen Sie eine neue mit anderen Assistenzärzten.",
"Assistenzarzt-Gruppe","Mitglieder","Gruppenmitglieder","Noch keine Nachrichten. Schreiben Sie die erste.","Nachricht an die Gruppe schreiben","Senden",
"Assistenzarzt nach Namen suchen","Keine Assistenzärzte zum Hinzufügen.","ausgewählt","ausgewählt","Gruppe erstellt","Neue Assistenzarzt-Gruppe",
"Geben Sie ihr einen Namen und wählen Sie, mit welchen Assistenzärzten Sie sprechen möchten.","Gruppenname (z. B. Dienst R1 Innere Medizin)","Gruppenname",
"Abbrechen","Gruppe erstellen","Wählen Sie eine Gruppe, um ihre Mitglieder zu sehen.","Assistenzarzt hinzugefügt","{n} Assistenzärzte hinzugefügt","Name aktualisiert",
"Gruppe verlassen","Sie sehen die Nachrichten dieser Gruppe dann nicht mehr. Jemand aus der Gruppe kann Sie wieder hinzufügen.","Sie haben die Gruppe verlassen",
"Neuer Gruppenname","Speichern","Umbenennen","Sie","Admin","Hinzufügen","Assistenzärzte hinzufügen"],
"ca": [
"Tria almenys un resident per al grup.","Posa un nom al grup.","Els grups són només entre residents.",
"Només qui administra el grup pot canviar-ne el nom.","Ja no formes part d'aquest grup.","No s'ha pogut completar. Torna-ho a provar.",
"Cerca un grup","Grup nou","Cap grup coincideix amb la cerca.","Encara no ets a cap grup. Crea'n un amb altres residents per conversar.",
"Grup","membre","membres","Encara sense missatges","Resident","Tria un grup per veure la conversa o crea'n un de nou amb altres residents.",
"grup de residents","Membres","Membres del grup","Encara no hi ha missatges. Escriu el primer.","Escriu un missatge al grup","Envia",
"Cerca un resident pel nom","No hi ha residents per afegir.","seleccionat","seleccionats","Grup creat","Grup nou de residents",
"Posa-li un nom i tria amb quins residents vols conversar.","Nom del grup (p. ex. Guàrdia R1 Medicina Interna)","Nom del grup",
"Cancel·la","Crea el grup","Tria un grup per veure'n els membres.","Resident afegit","{n} residents afegits","Nom actualitzat",
"Surt del grup","Deixaràs de veure els missatges d'aquest grup. Algú del grup et pot tornar a afegir.","Has sortit del grup",
"Nom nou del grup","Desa","Canvia el nom","Tu","Admin","Afegeix","Afegeix residents"],
"zh": [
"请为群组至少选择一名住院医师。","请为群组命名。","群组仅限住院医师之间。",
"只有群组管理员可以更改名称。","您已不再是该群组成员。","无法完成，请重试。",
"搜索群组","新建群组","没有符合搜索条件的群组。","您还没有加入任何群组。与其他住院医师创建一个群组来交流吧。",
"群组","名成员","名成员","暂无消息","住院医师","选择一个群组查看对话，或与其他住院医师新建一个群组。",
"住院医师群组","成员","群组成员","还没有消息。来写第一条吧。","给群组发消息","发送",
"按姓名搜索住院医师","没有可添加的住院医师。","已选","已选","群组已创建","新建住院医师群组",
"为群组命名，并选择要与哪些住院医师交流。","群组名称（例如：R1 内科值班）","群组名称",
"取消","创建群组","选择一个群组查看其成员。","已添加住院医师","已添加 {n} 名住院医师","名称已更新",
"退出群组","您将不再看到该群组的消息。群组中的成员可以再次添加您。","您已退出群组",
"新的群组名称","保存","重命名","我","管理员","添加","添加住院医师"],
}
U = {
"es": ["Pantalla completa","Documento","Espectadores · % visto medio"],
"en": ["Full screen","Document","Viewers · average % watched"],
"pt": ["Tela cheia","Documento","Espectadores · % médio assistido"],
"fr": ["Plein écran","Document","Spectateurs · % moyen visionné"],
"it": ["Schermo intero","Documento","Spettatori · % media visualizzata"],
"de": ["Vollbild","Dokument","Zuschauer · durchschnittlich gesehen in %"],
"ca": ["Pantalla completa","Document","Espectadors · % vist de mitjana"],
"zh": ["全屏","文档","观看人数 · 平均观看比例"],
}
for l in D:
    assert len(D[l])==len(KEYS),(l,len(D[l]))
    out = "  residentGroupChat: {\n" + "".join(f"    {k}: {json.dumps(v, ensure_ascii=False)},\n" for k,v in zip(KEYS,D[l])) + "  },\n"
    out += "  uiLabels: {\n" + "".join(f"    {k}: {json.dumps(v, ensure_ascii=False)},\n" for k,v in zip(UI,U[l])) + "  },\n"
    p=f"src/lib/i18n/{l}.ts"; s=open(p,encoding="utf8").read()
    assert "residentGroupChat:" not in s and "uiLabels:" not in s
    i=s.rstrip().rfind("};")
    s=s[:i]+out+s[i:]
    open(p,"w",encoding="utf8").write(s)
print("ok")
