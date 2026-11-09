-- Séparation entre deux comptes fictifs : A crée ses données, B tente de les lire, modifier, supprimer ou détourner.
-- Vérifie aussi que chaque lecture/écriture faite par le navigateur (site/) passe pour un compte normal, avec les
-- colonnes exactes envoyées par l'app : c'est ce qui aurait attrapé le bug des règles de création qui se comptaient.
-- Se lance sur une base jetable (tests/rls.check.sh) ou, à la main, sur la vraie base : l'erreur finale volontaire
-- « RAPPORT » annule tout, rien ne reste. Attendu : « RAPPORT OK ».
-- Lecture du rapport : « A …/ok … » doit finir par « : 1 » ; « B …/anon …/limite …/interdit … » par « : 0 » ou « refusé ».
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  ca uuid; cda uuid; qa uuid; sa uuid; n int; r text[] := '{}';
  cb uuid := gen_random_uuid(); sb uuid := gen_random_uuid(); cdb uuid; cdt uuid; qb uuid; tr uuid := gen_random_uuid();
  ver int; stamp timestamptz; j jsonb; code text; ok boolean; s text;
begin
  -- created_at explicite : sur Supabase, c'est le service de connexion qui le remplit (pas de valeur par défaut).
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at) values (a,'authenticated','authenticated','rls-a@test.invalid', now(), now()), (b,'authenticated','authenticated','rls-b@test.invalid', now(), now());

  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  insert into study_courses(user_id,subject,title,kind,file_name,file_size,page_count,text_chars) values (a,'Bio','Cours A','texte','a.txt',10,1,10) returning id into ca;
  insert into study_cards(user_id,deck,kind,front,back,course_id) values (a,'D','qa','QA','RA',ca) returning id into cda;
  insert into study_questions(user_id,deck,question,choix,bonnes) values (a,'D','Q?','["x","y"]','[0]') returning id into qa;
  insert into study_schemas(user_id,deck,titre,largeur,hauteur) values (a,'D','S',10,10) returning id into sa;
  insert into widget_state(user_id,widget,data) values (a,'notes','{"t":"secret A"}');
  insert into storage.objects(bucket_id,name,owner) values ('cours', a||'/'||ca||'/original.txt', a);
  select count(*) into n from study_courses; r := array_append(r, (('A voit ses cours: '||n))::text);

  -- Les écritures de l'app, colonnes exactes (sans user_id quand l'app ne l'envoie pas).
  -- dashboard.html:2108 : upsert de chaque widget qui enregistre, dont le Guide.
  insert into widget_state(user_id,widget,data,updated_at)
    select a, w, '{"v":1}', now() from unnest(array['ecran','notes','taches','minuteur','habitudes','vol','ambiance','compte','raccourcis','playlist','lecture','inspiration','cahier','cartes','revisions','quiz','schemas','guide']) w
    on conflict (user_id,widget) do update set data = excluded.data, updated_at = excluded.updated_at;
  insert into widget_state(user_id,widget,data,updated_at) values (a,'guide','{"masque":true}',now())
    on conflict (user_id,widget) do update set data = excluded.data, updated_at = excluded.updated_at;
  select count(*) into n from widget_state where user_id=a; r := array_append(r, ('A enregistre ses 18 widgets: '||(n=18)::int)::text);
  select count(*) into n from widget_state where widget='guide' and data->>'masque'='true'; r := array_append(r, ('A met à jour son guide: '||n)::text);
  begin insert into widget_state(user_id,widget,data) values (a,'pirate','{}'); r := array_append(r, 'interdit: widget inconnu ACCEPTE'); exception when others then r := array_append(r, 'interdit: widget inconnu refusé'); end;
  -- cahier.js:606 et :483
  insert into study_courses(id,subject,title,kind,file_name,file_size,page_count,text_chars,chapters)
    values (cb,'Bio','Cours app','pdf','cours.pdf',2048,3,900,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','Ch 1','page',0,'offset',0)));
  select count(*) into n from study_courses where id=cb and user_id=a; r := array_append(r, ('A crée un cours comme l''app: '||n)::text);
  update study_courses set chapters='[]', updated_at=now() where id=cb; get diagnostics n = row_count; r := array_append(r, ('A renomme ses chapitres: '||n)::text);
  perform id,subject,title,kind,file_name,file_size,page_count,text_chars,chapters from study_courses order by created_at;
  begin insert into storage.objects(bucket_id,name,owner) values ('cours', a||'/'||cb||'/original.pdf', a), ('cours', a||'/'||cb||'/texte.json', a); r := array_append(r, 'A dépose les fichiers du cours: 1'); exception when others then r := array_append(r, 'A dépose les fichiers du cours: refusé '||sqlerrm); end;
  begin insert into storage.objects(bucket_id,name,owner) values ('schemas', a||'/'||sb||'.jpg', a), ('inspiration', a||'/1.jpg', a), ('fonds', a||'/fond.jpg', a); r := array_append(r, 'A dépose schéma, inspiration, fond: 1'); exception when others then r := array_append(r, 'A dépose schéma, inspiration, fond: refusé '||sqlerrm); end;
  select count(*) into n from storage.objects where owner=a; r := array_append(r, ('A relit ses 6 fichiers: '||(n=6)::int)::text);
  -- cartes.js:238 (qa et trou), :474 (import CSV), ia.js:153 (depuis le cours)
  insert into study_cards(deck,kind,front,back,holes,course_id,src_page,src_offset,src_length) values ('D','qa','Q app','R app','[]',cb,0,0,10) returning id into cdb;
  insert into study_cards(deck,kind,front,holes,back) values ('D','trou','Le ciel est bleu','[[12,16]]','') returning id into cdt;
  insert into study_cards(deck,kind,front,back,holes) values ('CSV','qa','q1','r1','[]'), ('CSV','qa','q2','r2','[]');
  select count(*) into n from study_cards where user_id=a; r := array_append(r, ('A crée ses cartes comme l''app: '||(n=5)::int)::text);
  update study_cards set deck='D', kind='qa', front='Q app 2', back='R app', holes='[]' where id=cdb; get diagnostics n = row_count; r := array_append(r, ('A modifie sa carte: '||n)::text);
  perform id,deck,kind,front,back,holes,course_id,src_page,src_offset,src_length,version,last_rating,last_reviewed_at,created_at,fsrs,due from study_cards order by created_at, id;
  -- cartes.js:45 : réponse de révision ; le double clic (même p_prev) ne compte pas.
  select version into ver from study_cards where id=cdb;
  stamp := study_answer(cdb, ver, null, 3::smallint, '{"stability":1}'::jsonb, now() + interval '1 day');
  r := array_append(r, ('A révise sa carte: '||(stamp is not null)::int)::text);
  r := array_append(r, ('A double clic ignoré: '||(study_answer(cdb, ver, null, 3::smallint, '{}'::jsonb, now()) is null)::int)::text);
  select count(*) into n from study_cards where id=cdb and last_rating=3 and due is not null; r := array_append(r, ('A voit sa carte planifiée: '||n)::text);
  select count(*) into n from study_reviews where card_id=cdb; r := array_append(r, ('A a une réponse enregistrée: '||n)::text);
  -- guide.js:27
  perform id from study_courses limit 1; perform id from study_cards limit 1; perform id from study_reviews limit 1;
  -- quiz.js:304 (créer, corriger), :346 (import), :181 (signaler), :201 (répondre) ; ia.js:187
  insert into study_questions(question,choix,bonnes,deck,explication) values ('Q app?','["a","b","c"]','[0,2]','Q','') returning id into qb;
  insert into study_questions(question,choix,bonnes,deck) values ('Imp 1','["a","b"]','[0]','CSV'), ('Imp 2','["a","b"]','[0]','CSV');
  insert into study_questions(deck,question,choix,bonnes,explication,course_id,src_page,src_offset,src_length) values ('Cours app','Q ia?','["a","b"]','[1]','car',cb,0,0,5);
  update study_questions set signalee=true where id=qb; get diagnostics n = row_count; r := array_append(r, ('A signale sa question: '||n)::text);
  update study_questions set question='Q app 2?', choix='["a","b"]', bonnes='[1]', deck='Q', explication='x', signalee=false where id=qb; get diagnostics n = row_count; r := array_append(r, ('A corrige sa question: '||n)::text);
  select version into ver from study_questions where id=qb;
  insert into study_quiz_answers(question_id,question_version,donnees,reussie) values (qb,ver,'[1]',true);
  select count(*) into n from study_questions where id=qb and derniere_reussie and version=2; r := array_append(r, ('A répond à son quiz: '||n)::text);
  perform id,deck,question,choix,bonnes,explication,course_id,src_page,src_offset,src_length,version,signalee,derniere_reussie,derniere_at,created_at from study_questions order by created_at, id;
  -- schemas.js:291, :232, :252, :368, :96-97
  insert into study_schemas(id,titre,deck,zones,zones_a_verifier,image_version,course_id,src_page,largeur,hauteur) values (sb,'Cellule','Bio','[]',false,1,cb,0,800,600);
  update study_schemas set zones='[{"id":"z1","x":0.1,"y":0.1,"w":0.2,"h":0.1,"reponse":"noyau"}]', zones_a_verifier=false, updated_at=now() where id=sb; get diagnostics n = row_count; r := array_append(r, ('A encadre ses zones: '||n)::text);
  update study_schemas set largeur=640, hauteur=480, image_version=2, zones_a_verifier=true where id=sb; get diagnostics n = row_count; r := array_append(r, ('A remplace son image: '||n)::text);
  insert into study_schema_answers(schema_id,zone_id,reussie) values (sb,'z1',true), (sb,'z2',false);
  select count(*) into n from study_schema_answers where schema_id=sb; r := array_append(r, ('A répond à son schéma: '||(n=2)::int)::text);
  perform id,deck,titre,course_id,src_page,largeur,hauteur,zones,zones_a_verifier,image_version,created_at from study_schemas order by created_at;
  perform schema_id,zone_id,reussie,created_at from study_schema_answers order by created_at desc limit 2000;
  -- dashboard.html:2699
  select referral_code into code from get_my_referral(); r := array_append(r, ('A obtient son code de parrainage: '||(code is not null)::int)::text);
  r := array_append(r, ('interdit: A se parraine lui-même: '||claim_referral(code)::int)::text);
  begin perform 1 from referral_codes; r := array_append(r, 'interdit: A lit la table des codes: ACCEPTE'); exception when insufficient_privilege then r := array_append(r, 'interdit: A lit la table des codes: refusé'); end;
  begin insert into referrals(referred_id,referrer_id) values (a,b); r := array_append(r, 'interdit: A écrit un parrainage: ACCEPTE'); exception when insufficient_privilege then r := array_append(r, 'interdit: A écrit un parrainage: refusé'); end;

  -- Quotas : un lot qui remplit jusqu'au plafond passe, une ligne de plus est refusée.
  select count(*) into n from study_courses;
  for i in n+1..30 loop insert into study_courses(user_id,subject,title,kind,file_name,file_size,page_count,text_chars) values (a,'Bio','Cours '||i,'texte','a.txt',10,1,10); end loop;
  begin insert into study_courses(user_id,subject,title,kind,file_name,file_size,page_count,text_chars) values (a,'Bio','Cours 31','texte','a.txt',10,1,10); r := array_append(r, 'limite: 31e cours de A ACCEPTE'); exception when others then r := array_append(r, 'limite: 31e cours de A refusé'); end;
  select count(*) into n from study_cards; insert into study_cards(deck,kind,front,back) select 'Q','qa','f'||g,'b' from generate_series(n+1,3000) g;
  begin insert into study_cards(deck,kind,front,back) values ('Q','qa','f','b'); r := array_append(r, 'limite: 3001e carte de A ACCEPTE'); exception when others then r := array_append(r, 'limite: 3001e carte de A refusé'); end;
  select count(*) into n from study_questions; insert into study_questions(deck,question,choix,bonnes) select 'Q','q'||g,'["a","b"]','[0]' from generate_series(n+1,3000) g;
  begin insert into study_questions(deck,question,choix,bonnes) values ('Q','q','["a","b"]','[0]'); r := array_append(r, 'limite: 3001e question de A ACCEPTE'); exception when others then r := array_append(r, 'limite: 3001e question de A refusé'); end;
  select count(*) into n from study_schemas; insert into study_schemas(deck,titre,largeur,hauteur) select 'Q','s'||g,10,10 from generate_series(n+1,200) g;
  begin insert into study_schemas(deck,titre,largeur,hauteur) values ('Q','s',10,10); r := array_append(r, 'limite: 201e schéma de A ACCEPTE'); exception when others then r := array_append(r, 'limite: 201e schéma de A refusé'); end;
  -- Un seul envoi de plusieurs lignes ne doit pas dépasser le plafond (l'import CSV envoie jusqu'à 500 lignes d'un coup).
  delete from study_courses where title='Cours 30';
  begin insert into study_courses(user_id,subject,title,kind,file_name,file_size,page_count,text_chars) values (a,'Bio','Lot 1','texte','a.txt',10,1,10), (a,'Bio','Lot 2','texte','a.txt',10,1,10), (a,'Bio','Lot 3','texte','a.txt',10,1,10);
    select count(*) into n from study_courses; r := array_append(r, 'limite: lot de 3 cours à 29/30 ACCEPTE, total '||n); exception when others then r := array_append(r, 'limite: lot de 3 cours à 29/30 refusé'); end;

  -- IA : le navigateur ne peut que lire (ia.js:26, :29, :38). Toute écriture passe par la fonction serveur.
  begin perform ia_reserver(a, gen_random_uuid(), 'cartes', 100); r := array_append(r, 'interdit: A appelle ia_reserver: ACCEPTE'); exception when insufficient_privilege then r := array_append(r, 'interdit: A appelle ia_reserver: refusé'); end;
  begin perform ia_terminer(gen_random_uuid(), 'echoue', null, 0); r := array_append(r, 'interdit: A appelle ia_terminer: ACCEPTE'); exception when insufficient_privilege then r := array_append(r, 'interdit: A appelle ia_terminer: refusé'); end;
  reset role;
  -- Ce que fait la fonction serveur « ia » (rôle service) : réserver puis terminer un travail pour A.
  j := ia_reserver(a, tr, 'cartes', 100, 'cours:'||cb);
  perform ia_terminer(tr, 'reussi', '{"cartes":[]}'::jsonb, 0.5);
  set local role authenticated;
  select count(*) into n from ia_prix; r := array_append(r, ('A lit la grille de prix: '||(n=4)::int)::text);
  select count(*) into n from ia_portefeuilles where solde > 0; r := array_append(r, ('A lit son solde: '||n)::text);
  select count(*) into n from (select id,resultat,created_at from ia_travaux where type='cartes' and cle='cours:'||cb and etat='reussi' order by created_at desc limit 1) x; r := array_append(r, ('A retrouve son travail IA: '||n)::text);
  select count(*) into n from ia_journal; r := array_append(r, ('A lit son journal: '||(n>0)::int)::text);
  begin update ia_portefeuilles set solde=9999 where user_id=a; get diagnostics n = row_count; r := array_append(r, 'interdit: A modifie son solde: '||n); exception when insufficient_privilege then r := array_append(r, 'interdit: A modifie son solde: refusé'); end;
  begin insert into ia_journal(user_id,variation,motif,solde_apres) values (a,999,'ajustement',999); r := array_append(r, 'interdit: A écrit son journal: ACCEPTE'); exception when insufficient_privilege then r := array_append(r, 'interdit: A écrit son journal: refusé'); end;
  begin insert into ia_travaux(id,user_id,type,etat,caracteres,credits) values (gen_random_uuid(),a,'cartes','reussi',1,0); r := array_append(r, 'interdit: A crée un travail: ACCEPTE'); exception when insufficient_privilege then r := array_append(r, 'interdit: A crée un travail: refusé'); end;
  begin update ia_prix set credits_min=0; r := array_append(r, 'interdit: A change les prix: ACCEPTE'); exception when insufficient_privilege then r := array_append(r, 'interdit: A change les prix: refusé'); end;
  select count(*) into n from ia_reglages; r := array_append(r, ('interdit: A lit les réglages IA: '||n)::text);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;
  select count(*) into n from study_courses where user_id=a; r := array_append(r, (('B lit cours A: '||n))::text);
  select count(*) into n from study_cards where user_id=a; r := array_append(r, (('B lit cartes A: '||n))::text);
  select count(*) into n from study_questions where user_id=a; r := array_append(r, (('B lit questions A: '||n))::text);
  select count(*) into n from study_schemas where user_id=a; r := array_append(r, (('B lit schemas A: '||n))::text);
  select count(*) into n from study_reviews where user_id=a; r := array_append(r, (('B lit révisions A: '||n))::text);
  select count(*) into n from study_quiz_answers where user_id=a; r := array_append(r, (('B lit réponses quiz A: '||n))::text);
  select count(*) into n from study_schema_answers where user_id=a; r := array_append(r, (('B lit réponses schémas A: '||n))::text);
  select count(*) into n from ia_portefeuilles where user_id=a; r := array_append(r, (('B lit portefeuille A: '||n))::text);
  select count(*) into n from ia_journal where user_id=a; r := array_append(r, (('B lit journal IA A: '||n))::text);
  select count(*) into n from ia_travaux where user_id=a; r := array_append(r, (('B lit travaux IA A: '||n))::text);
  select count(*) into n from widget_state where user_id=a; r := array_append(r, (('B lit widgets A: '||n))::text);
  select count(*) into n from widget_state where widget='guide'; r := array_append(r, (('B lit guide A: '||n))::text);
  select count(*) into n from storage.objects where name like a||'/%'; r := array_append(r, (('B lit fichiers A: '||n))::text);
  update study_courses set title='pirate' where id=ca; get diagnostics n = row_count; r := array_append(r, (('B modifie cours A: '||n))::text);
  update study_cards set front='pirate' where id=cda; get diagnostics n = row_count; r := array_append(r, (('B modifie carte A: '||n))::text);
  update widget_state set data='{}' where user_id=a; get diagnostics n = row_count; r := array_append(r, (('B modifie widget A: '||n))::text);
  update study_questions set signalee=true where id=qb; get diagnostics n = row_count; r := array_append(r, (('B signale question A: '||n))::text);
  update study_schemas set zones='[]' where id=sb; get diagnostics n = row_count; r := array_append(r, (('B modifie schéma A: '||n))::text);
  r := array_append(r, ('B révise carte A via study_answer: '||(study_answer(cdb, 1, null, 4::smallint, '{}'::jsonb, now()) is not null)::int)::text);
  delete from study_cards where id=cda; get diagnostics n = row_count; r := array_append(r, (('B supprime carte A: '||n))::text);
  delete from study_questions where id=qa; get diagnostics n = row_count; r := array_append(r, (('B supprime question A: '||n))::text);
  delete from study_schemas where id=sa; get diagnostics n = row_count; r := array_append(r, (('B supprime schema A: '||n))::text);
  delete from study_courses where id=ca; get diagnostics n = row_count; r := array_append(r, (('B supprime cours A: '||n))::text);
  begin insert into study_cards(user_id,deck,kind,front,back) values (a,'D','qa','x','y'); r := array_append(r, ('B crée carte au nom de A: ACCEPTE')::text); exception when others then r := array_append(r, ('B crée carte au nom de A: refusé')::text); end;
  begin insert into study_cards(user_id,deck,kind,front,back,course_id) values (b,'D','qa','x','y',ca); r := array_append(r, ('B rattache carte au cours A: ACCEPTE')::text); exception when others then r := array_append(r, ('B rattache carte au cours A: refusé')::text); end;
  begin insert into study_reviews(user_id,card_id,card_version,rating) values (b,cda,1,3); r := array_append(r, ('B répond à carte A: ACCEPTE')::text); exception when others then r := array_append(r, ('B répond à carte A: refusé ('||left(sqlerrm,40)||')')::text); end;
  begin insert into study_quiz_answers(user_id,question_id,question_version,donnees,reussie) values (b,qa,1,'[0]',true); r := array_append(r, ('B répond question A: ACCEPTE')::text); exception when others then r := array_append(r, ('B répond question A: refusé ('||left(sqlerrm,40)||')')::text); end;
  begin insert into study_schema_answers(schema_id,zone_id,reussie) values (sb,'z1',true); r := array_append(r, ('B répond schéma A: ACCEPTE')::text); exception when others then r := array_append(r, ('B répond schéma A: refusé ('||left(sqlerrm,40)||')')::text); end;
  begin insert into storage.objects(bucket_id,name,owner) values ('cours', a||'/'||ca||'/texte.json', b); r := array_append(r, ('B écrit fichier chez A: ACCEPTE')::text); exception when others then r := array_append(r, ('B écrit fichier chez A: refusé')::text); end;
  begin insert into storage.objects(bucket_id,name,owner) values ('schemas', a||'/'||gen_random_uuid()||'.jpg', b); r := array_append(r, ('B écrit schéma chez A: ACCEPTE')::text); exception when others then r := array_append(r, ('B écrit schéma chez A: refusé')::text); end;
  begin perform 1 from referral_codes; r := array_append(r, 'B lit les codes de parrainage: ACCEPTE'); exception when insufficient_privilege then r := array_append(r, 'B lit les codes de parrainage: refusé'); end;
  -- B est un compte neuf : le code de A marche une fois, pas deux.
  insert into study_cards(deck,kind,front,back) values ('B','qa','à moi','oui');
  select count(*) into n from study_cards; r := array_append(r, ('ok B crée sa carte malgré le plein de A: '||n)::text);
  r := array_append(r, ('ok B utilise le code de A: '||claim_referral(lower(code))::int)::text);
  r := array_append(r, ('B réutilise un code: '||claim_referral(code)::int)::text);
  reset role;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin select count(*) into n from study_courses; r := array_append(r, ('anon lit cours: '||n)::text); exception when insufficient_privilege then r := array_append(r, 'anon lit cours: refusé'); end;
  begin select count(*) into n from widget_state; r := array_append(r, ('anon lit widgets: '||n)::text); exception when insufficient_privilege then r := array_append(r, 'anon lit widgets: refusé'); end;
  begin select count(*) into n from ia_portefeuilles; r := array_append(r, ('anon lit portefeuilles: '||n)::text); exception when insufficient_privilege then r := array_append(r, 'anon lit portefeuilles: refusé'); end;
  begin select count(*) into n from ia_prix; r := array_append(r, ('anon lit prix IA: '||n)::text); exception when insufficient_privilege then r := array_append(r, 'anon lit prix IA: refusé'); end;
  begin select count(*) into n from study_reviews; r := array_append(r, ('anon lit révisions: '||n)::text); exception when insufficient_privilege then r := array_append(r, 'anon lit révisions: refusé'); end;
  reset role;

  -- Fonctions qui contournent les règles (security definer) : aucune pour anon, seulement les trois prévues pour un compte.
  select string_agg(p.proname, ',') into s from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');
  r := array_append(r, 'anon exécute une fonction définisseur: '||coalesce(s, '0'));
  select string_agg(p.proname, ',') into s from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')
    and p.proname not in ('study_quota_ok', 'get_my_referral', 'claim_referral');
  r := array_append(r, 'interdit: autre fonction définisseur ouverte aux comptes: '||coalesce(s, '0'));
  r := array_append(r, 'anon exécute study_answer: '||has_function_privilege('anon', 'public.study_answer(uuid,integer,timestamptz,smallint,jsonb,timestamptz)', 'execute')::int);

  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  select count(*) into n from study_cards where id=cda and front='QA'; r := array_append(r, (('A garde sa carte intacte: '||n))::text);
  select count(*) into n from study_courses where id=ca and title='Cours A'; r := array_append(r, (('A garde son cours intact: '||n))::text);
  select count(*) into n from study_reviews where card_id=cdb; r := array_append(r, (('A garde une seule révision: '||n))::text);
  select referral_count into n from get_my_referral(); r := array_append(r, (('A voit son filleul: '||n))::text);
  delete from study_cards where id=cdt; get diagnostics n = row_count; r := array_append(r, ('A supprime sa carte: '||n)::text);
  delete from study_questions where id=qb; get diagnostics n = row_count; r := array_append(r, ('A supprime sa question: '||n)::text);
  delete from study_schemas where id=sb; get diagnostics n = row_count; r := array_append(r, ('A supprime son schéma: '||n)::text);
  delete from storage.objects where name = a||'/'||sb||'.jpg'; get diagnostics n = row_count; r := array_append(r, ('A supprime son image: '||n)::text);
  delete from study_courses where id=cb; get diagnostics n = row_count; r := array_append(r, ('A supprime son cours: '||n)::text);
  reset role;

  raise exception 'RAPPORT % (tout annulé) | %',
    case when exists (select 1 from unnest(r) x where (x ~ '^(B|anon|limite|interdit)' and x !~ '(: 0|refusé.*)$') or (x ~ '^(A|ok) ' and x !~ ': 1$')) then 'ECHEC' else 'OK' end,
    array_to_string(r, ' | ');
end $$;
