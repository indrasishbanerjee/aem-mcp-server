# AEM technical user ACL checklist

Create a dedicated user in **Tools → Security → Users**. This is not an OSGi service user and this repository does not ship RepoInit.

Grant the **minimum** privileges required by the tools you enable. Deny `/` write by default.

## Always required (reads + CSRF)

| Path | Privileges | Why |
| --- | --- | --- |
| `/libs/granite/csrf` | `jcr:read` | CSRF token |
| `/bin/querybuilder.json` | execute / read as configured by Dispatcher and Author | Search and listPages |
| Configured `AEM_SITES_ROOT` (default `/content`) | `jcr:read` | Discovery and page JSON |
| Configured `AEM_TEMPLATES_ROOT` (default `/conf`) | `jcr:read` | Templates |
| Configured `AEM_ASSETS_ROOT` (default `/content/dam`) | `jcr:read` | Asset metadata |

## Page write tools

| Path | Privileges |
| --- | --- |
| Site subtree you intend to mutate | `jcr:read`, `jcr:write`, `jcr:removeNode`, `jcr:nodeTypeManagement` as required by Sling POST / WCM |
| `/bin/wcmcommand` | allow in Dispatcher; user must be allowed to create/delete pages |
| Selected editable templates under `/conf/.../settings/wcm/templates` | `jcr:read` |

## Replication

| Path | Privileges |
| --- | --- |
| `/bin/replicate.json` | replicate privilege on the paths being activated |
| Replication agents you name in `AEM_DEFAULT_AGENT` | read as required by Author |

Do not grant replicate on the entire repository.

## DAM

| Path | Privileges |
| --- | --- |
| DAM folders used for upload | `jcr:read`, `jcr:write`, `jcr:nodeTypeManagement` |
| `*.createasset.html` | allowed through Dispatcher |

## Workflows

| Path | Privileges |
| --- | --- |
| `/etc/workflow/instances` | create workflow instances |
| `/var/workflow/instances` | read / change state for cancel-suspend-resume |
| `/var/workflow/models`, `/conf/.../workflow/models`, `/etc/workflow/models` | `jcr:read` |
| Payload paths | read (and workflow privilege as modeled) |

## Explicitly do not grant

- `jcr:all` on `/`
- User admin, package manager, CRXDE, or OSGi console
- Write on `/libs`, `/apps`, `/oak:index`, `/home` (except the user’s own home if AEM requires it)
- Replication to arbitrary agents you do not operate

Verify with a non-admin login in Author before pointing this server at production Author.
