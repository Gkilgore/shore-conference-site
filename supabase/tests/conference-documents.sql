-- Test who can add, edit and remove conference documents, with fictional identities; roll back every fixture.
begin;
do $$
declare office uuid := gen_random_uuid(); ad uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at) values(office,'doc-office@example.org',now()),(ad,'doc-ad@example.org',now());
  insert into public.users(email,name,role,school_id) values('doc-office@example.org','Doc office','conference_office',null),
    ('doc-ad@example.org','Doc AD','ad','marlboro');
  perform set_config('shore.doc_office',office::text,true);
  perform set_config('shore.doc_ad',ad::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',office,'role','authenticated')::text,true);
end;
$$;

-- A conference admin adds, edits and removes a document; bad rows are refused.
set local role authenticated;
do $$
declare doc uuid; rejected boolean;
begin
  insert into public.conference_documents(title,type,sport,school_year,file_path,description)
    values('2027 Test Rules','Tournament regulations','Soccer','2027-28','2027-28/test_rules-abc123.pdf','Fixture.') returning id into doc;
  update public.conference_documents set title='2027 Test Rules, revised' where id=doc;
  if not exists(select 1 from public.conference_documents where id=doc and title='2027 Test Rules, revised' and added=current_date) then
    raise exception 'Conference admin edit failed'; end if;
  rejected := false;
  begin insert into public.conference_documents(title,type,school_year,file_path,description)
    values('Bad year','Other','2027-29','2027-29/x.pdf','Fixture.');
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'Bad school year accepted'; end if;
  rejected := false;
  begin insert into public.conference_documents(title,type,school_year,file_path,description)
    values('Wrong folder','Other','2027-28','2026-27/x.pdf','Fixture.');
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'File outside its school year folder accepted'; end if;
  rejected := false;
  begin insert into public.conference_documents(title,type,school_year,file_path,description)
    values('Bad type','Newsletter','2027-28','2027-28/y.pdf','Fixture.');
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'Unknown type accepted'; end if;
  perform set_config('shore.doc_id',doc::text,true);
end;
$$;

-- An AD can read the list but cannot add, edit or remove.
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.doc_ad'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare doc uuid := current_setting('shore.doc_id')::uuid; affected integer; rejected boolean;
begin
  if not exists(select 1 from public.conference_documents where id=doc) then raise exception 'AD cannot read documents'; end if;
  rejected := false;
  begin insert into public.conference_documents(title,type,school_year,file_path,description)
    values('AD upload','Other','2027-28','2027-28/ad.pdf','Fixture.');
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'AD added a document'; end if;
  update public.conference_documents set title='Changed by AD' where id=doc;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'AD edited a document'; end if;
  delete from public.conference_documents where id=doc;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'AD removed a document'; end if;
end;
$$;

-- The public reads the list but not who uploaded each file.
reset role;
set local role anon;
do $$
declare rejected boolean := false;
begin
  if not exists(select 1 from public.conference_documents where id=current_setting('shore.doc_id')::uuid) then
    raise exception 'Public cannot read documents'; end if;
  begin perform uploaded_by from public.conference_documents limit 1;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Public can read uploader emails'; end if;
end;
$$;
reset role;
rollback;
