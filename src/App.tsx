import FileBrowser, {FileTreeI} from "./component/FileBrowser";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {CreateDirectory, CreateFile, DeleteFile, GetFileTree, Publish, SaveFile, UploadFiles} from "./api/file";
import {GetConfig, Login, Pull, Push} from "./api/base";

import FileEditor, {FileI} from "./component/FileEditor";
import {Header, MenuI} from "./component/Header";
import {MenuVertical} from "./component/MenuVertical";
import Confirm from "./component/Confirm";
import NewFileModal, {NewFileInfo} from "./particle/NewFileModal";
import PublishModal from "./particle/PublishModal";
import debounce from "lodash/debounce";
import ProcessModal from "./particle/ProcessModal";
import LoginModal from "./particle/LoginModal";
import {AxiosError} from "axios";
import PullModal, {Repo} from "./particle/PullModal";
import {Toast} from "./util/Toast";
import FilePreview from "./component/FilePreview";

// FileStatus 可以被序列化，刷新页面恢复
export interface FileStatus {
    modifiedFiles: FileI[]
    currFile?: FileTreeI
    openedDir?: FileI[]
}


interface ProcessModalI {
    title: string
    wsKey?: string
}

function UseStorage<T>(key: string, initVal: T): [T, (t: T) => void] {
    const raw = localStorage.getItem(key)

    const [value, setValue] = useState<T>(raw ? JSON.parse(raw) : initVal)
    const updater = useCallback(
        (updatedValue: T) => {
            localStorage.setItem(key, JSON.stringify(updatedValue))
            setValue(updatedValue);
        },
        [key],
    );

    return [value, updater]
}

interface PullModalData {
    repo?: Repo
}

function App() {
    const [pid, setPid] = useState(1)
    const [workspace, setWorkspace] = useState<'project' | 'theme'>('project')
    const [fileTreeProject, setFileTreeProject] = useState<FileTreeI>()
    const [newFileInfo, setNewFileInfo] = useState<NewFileInfo>()
    const [showPublishModal, setShowPublishModal] = useState(false)
    const [drawer, setDrawer] = useState(false)
    const [fileStatus, setFileStatus] = UseStorage<FileStatus>("file_status", {modifiedFiles: []})
    const bucket = workspace
    const [processModal, setProcessModal] = useState<ProcessModalI>()
    const [loginModal, setLoginModal] = useState<boolean>(false)

    const [pullModal, setPullModal] = useState<PullModalData>()
    const filePreviewDom = useRef<HTMLDivElement>(null);

    const setFileStatusFileModified = (fileStatus: FileStatus, f: FileI, modify: boolean) => {
        const newStatus = {...fileStatus}
        // console.log('fileStatus.modifiedFiles', fileStatus.modifiedFiles)
        const idx = fileStatus.modifiedFiles.findIndex(i => i.path === f.path)
        if (idx === -1) {
            if (modify) {
                newStatus.modifiedFiles.push(f)
            } else {
                return
            }
        } else {
            if (!modify) {
                newStatus.modifiedFiles.splice(idx, 1)
            } else {
                return
            }
        }

        setFileStatus(newStatus)
    }

    const reloadFileTree = async () => {
        const ft = await GetFileTree({project_id: pid, path: "", bucket: 'project'})
        setFileTreeProject(ft.data)
        {
            // const ft = await GetFileTree({project_id: pid, path: "", bucket: 'theme'})
            // setFileTreeTheme(ft.data)
        }
    }
    useEffect(() => {
        (reloadFileTree)();
    }, [])

    const onFileChange = useCallback((f: FileI) => {
        console.log('onFileChange', f.path)
        setFileStatusFileModified(fileStatus, f!, true)
        // 自动保存
        debounceSave(fileStatus, f)
    }, [fileStatus])

    const onFileSave = async (fileStatus: FileStatus, f: FileI) => {
        console.log('onFileSave', f.path)
        setFileStatusFileModified(fileStatus, f, false)
        await SaveFile({project_id: pid, path: f?.path!, bucket: bucket, body: f.body})
    }


    const debounceSave = useMemo(() => {
        return debounce(async (fileStatus: FileStatus, f: FileI) => {
            await onFileSave(fileStatus, f)
        }, 1000)
    }, [])

    const onFileClick = async (f: FileI) => {
        if (!f.is_dir) {
            // const nf = await GetFile({project_id: pid, path: f.path, bucket: bucket})
            setFileStatus({
                ...fileStatus,
                currFile: f,
            })
        } else {
            const newStatus = {...fileStatus}
            if (!newStatus.openedDir) {
                newStatus.openedDir = []
            }

            const idx = fileStatus.openedDir?.findIndex(i => i.path === f.path)
            if (idx !== undefined && idx >= 0) {
                newStatus.openedDir.splice(idx, 1)
            } else {
                newStatus.openedDir.push(f)
            }

            setFileStatus(newStatus)
        }
    }

    const onFileMenu = async (m: MenuI, f: FileTreeI) => {
        switch (m.key) {
            case 'new file':
                setNewFileInfo({
                    isDir: false,
                    parentPath: f.dir_path,
                })
                break
            case 'new directory':
                setNewFileInfo({
                    isDir: true,
                    parentPath: f.dir_path,
                })
                break
            case 'delete':
                const r = await Confirm({
                    title: "Delete",
                    children: (f.is_dir ? (<span>delete directory '{f.path}'？</span>) :
                        <span>delete file '{f.path}'？</span>)
                })
                if (r.ok) {
                    await DeleteFile({project_id: pid, path: f.path, is_dir: f.is_dir, bucket: bucket})
                    await reloadFileTree()
                }
        }
    }

    const switchDrawer = () => {
        setDrawer(!drawer)
    }

    const doNewFile = async (newFileName: string, uploadFiles: File[]) => {
        if (uploadFiles.length !== 0) {
            await UploadFiles({
                project_id: pid,
                files: uploadFiles,
                path: newFileInfo?.parentPath!,
                bucket: bucket,
            })
        } else {
            const path = newFileInfo?.parentPath + "/" + newFileName
            if (newFileInfo?.isDir) {
                await CreateDirectory({
                    project_id: pid,
                    path: path,
                    bucket: bucket,
                    body: "",
                })
            } else {
                await CreateFile({
                    project_id: pid,
                    path: path,
                    bucket: bucket,
                    body: "",
                })
            }
        }

        await reloadFileTree()
        setNewFileInfo(undefined)
    }
    const onCloseNewFile = () => {
        setNewFileInfo(undefined);
    }

    const headMenus: MenuI[] = [{
        key: "file",
        name: "File"
    }]

    const onLeftTab = (m: MenuI) => {
        switch (m.key) {
            case 'files':
                setWorkspace("project")
                switchDrawer()
                break
            case 'theme':
                setWorkspace("theme")
                break

        }
    }

    const doPublish = async () => {
        await Publish({
            project_id: pid,
        })
    }

    const onTopMenu = async (m: MenuI) => {
        switch (m.key) {
            case 'publish':
                setShowPublishModal(true)
                return
            case "update project":
                const r = await GetConfig()
                setPullModal({repo: r.data.source})
                break
            case "push":
                const r1 = await GetConfig()
                let rr = await Push(r1.data.source)
                setProcessModal({
                    title: "update",
                    wsKey: rr.data,
                })
        }
        onLeftTab(m)
        return
    }

    const doPull = async (repo: Repo) => {
        let r = await Pull(repo)
        setPullModal(undefined)
        setProcessModal({
            title: "update",
            wsKey: r.data,
        })
    }

    let login = async (secret: string) => {
        await Login({secret})
        window.location = window.location
        return
    }

    useEffect(() => {
        console.log('app');

        (async function () {
            try {
                let r = await Login({secret: ''})
                console.log(r)
            } catch (e) {
                if (e instanceof AxiosError) {
                    console.log(e.response?.data.code, e.response?.data.code == 401)
                    if (e.response?.data.code == 401) {
                        setLoginModal(true)
                    }
                }
            }
        })()
    }, [])

    return (
        <div id="app" className=" h-full" data-theme="dark">
            <div className="flex flex-col space-y-2 bg-gray-1A1E2A h-full">
                <Header menus={headMenus} onMenuClick={onTopMenu} currFile={fileStatus.currFile} drawer={drawer}
                        fileStatus={fileStatus}></Header>
                <section className="flex-1 flex h-0 relative">
                    <div className="absolute z-10 p-1 pl-0 pt-0 " style={{left: 0, top: 0}}>
                        <MenuVertical
                            menus={[
                                {key: "files", name: "Files"},
                            ]}
                            activeKey={workspace}
                            onMenuClick={onLeftTab}></MenuVertical>
                    </div>
                    <div className="drawer drawer-mobile h-auto flex-1">
                        <input
                            type="checkbox"
                            checked={drawer}
                            onChange={() => {
                            }}
                            className="drawer-toggle"/>
                        <div className="drawer-content h-full">
                            <div className="rounded-lg h-full overflow-hidden">
                                <div className="flex h-full">
                                    <div className="w-1/2">
                                        <FileEditor
                                            file={fileStatus.currFile} onChange={onFileChange}
                                            onSave={async (f) => {
                                                await onFileSave(fileStatus, f)
                                            }}
                                            onScroll={(e, body) => {
                                                if (filePreviewDom.current) {
                                                    syncScroll(body, e, filePreviewDom.current)
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="h-full overflow-y-auto" ref={filePreviewDom}>
                                        <FilePreview file={fileStatus.currFile}></FilePreview>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="drawer-side" style={{"height": '100%', 'overflowY': "auto"}}>
                            <label onClick={() => setDrawer(false)} className="drawer-overlay "></label>
                            <div
                                className="menu w-60 flex flex-col mr-2 bg-gray-272C38 rounded-lg overflow-y-auto overflow-x-auto">
                                <>
                                    <div style={{display: workspace === 'project' ? '' : 'none'}}>
                                        <FileBrowser
                                            tree={fileTreeProject}
                                            status={fileStatus}
                                            onFileClick={onFileClick}
                                            onMenu={onFileMenu}
                                        ></FileBrowser>
                                    </div>
                                </>

                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* New file Modal */}
            <NewFileModal
                onClose={onCloseNewFile}
                onConfirm={doNewFile}
                newFileInfo={newFileInfo}
            ></NewFileModal>
            {/* Publish Modal */}
            <PublishModal
                onClose={() => {
                    setShowPublishModal(false)
                }}
                show={showPublishModal}
                onConfirm={doPublish}
            ></PublishModal>

            {pullModal ?
                <PullModal
                    repo={pullModal?.repo}
                    show={!!pullModal}
                    onClose={() => {
                        setPullModal(undefined)
                    }}
                    onConfirm={async (v) => {
                        await doPull(v)
                    }}></PullModal> : null}

            {processModal ?
                <ProcessModal
                    onClose={() => {
                        setProcessModal(undefined)
                    }}
                    show={true}
                    onConfirm={doPublish}
                    wsKey={processModal?.wsKey}
                ></ProcessModal> : null}

            <LoginModal onConfirm={login} show={loginModal}></LoginModal>

            <Toast/>

        </div>
    );
}

// 作者：三苗同学
// 链接：https://juejin.cn/post/7086353349544509447
//     来源：稀土掘金
// 著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。
function similar(s: string, t: string, f = 2) {
    if (!s || !t) {
        return 0
    }
    if (s === t) {
        return 100;
    }
    var l = s.length > t.length ? s.length : t.length
    var n = s.length
    var m = t.length
    var d: any[] = []
    f = f || 2
    var min = function (a: number, b: number, c: number) {
        return a < b ? (a < c ? a : c) : (b < c ? b : c)
    }
    var i, j, si, tj, cost
    if (n === 0) return m
    if (m === 0) return n
    for (i = 0; i <= n; i++) {
        d[i] = []
        d[i][0] = i
    }
    for (j = 0; j <= m; j++) {
        d[0][j] = j
    }
    for (i = 1; i <= n; i++) {
        si = s.charAt(i - 1)
        for (j = 1; j <= m; j++) {
            tj = t.charAt(j - 1)
            if (si === tj) {
                cost = 0
            } else {
                cost = 1
            }
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
        }
    }
    let res = (1 - d[n][m] / l) * 100
    return res.toFixed(f)
}

//
function matchAnchor(from: HTMLElement, anchor: HTMLElement) {
    //
    return
}

function matchAnchorFromSource(ratio: number, ratios: number[]) {
    for (let i = 0; i < ratios.length; i++) {
        if (ratios[i] > ratio) {
            return i
        }
    }

    return -1
}

// syncScroll 简单的同步滚动方案
function syncScroll(source: string | undefined, from: HTMLDivElement, to: HTMLDivElement) {
    const fromHeight = from.scrollHeight - from.clientHeight
    const toHeight = to.scrollHeight - to.clientHeight
    const ratio = from.scrollTop / fromHeight
    to.scrollTop = toHeight * ratio
}

// syncScrollV2 复杂的同步滚动方案，将通过标题作为锚点，不过由于 codeMirror 会重用 dom，这个方案还未实现。
// 难点
// - codeMirror 会重用 dom，导致数量和位置和预览的 dom 对应不起来。
// - 源文件也没办法很好的对应预览 dom，因为 codeMirror 会对源文件换行展示。
function syncScrollV2(source: string | undefined, from: HTMLDivElement, to: HTMLDivElement) {
    let sourceItem = getAnchorForSource(source || '')

    // console.log('sourceItem', sourceItem)
    // let fromItem = getAnchorForMDSource(from)
    let toItems = getAnchorForMDPreview(to)

    if (sourceItem.length == 0) {
        let start = 0
        let toStart = 0
        let end = from.clientHeight
        let toEnd = to.clientHeight
        const ratio = (from.scrollTop - start) / (end - start)
        to.scrollTop = toStart + (toEnd - toStart) * ratio
        return
    }

    // const firstItemIndex = fromItem.findIndex((h) => {
    //     return h.offsetTop > from.scrollTop
    // })

    const fromRatio = from.scrollTop/(from.scrollHeight - from.clientHeight)
    console.log('from.scrollTop', fromRatio )
    const firstItemIndex = matchAnchorFromSource(fromRatio, sourceItem.map((h) => h.ratio))
    const firstItem = sourceItem[firstItemIndex]

    console.log('firstItem', firstItemIndex, sourceItem.length, toItems.length)

    if (firstItemIndex === -1) {
        const lastIndex = sourceItem.length - 1
        // let start = fromItem[lastIndex].offsetTop
        let start = from.clientHeight * sourceItem[firstItemIndex - 1].ratio
        let toStart = toItems[lastIndex].offsetTop
        let end = from.clientHeight
        let toEnd = to.clientHeight


        const ratio = (from.scrollTop - start) / (end - start)
        to.scrollTop = toStart + (toEnd - toStart) * ratio
    } else {
        let start = 0
        let toStart = 0
        // let end = fromItem[firstItemIndex].offsetTop
        let end = from.clientHeight * firstItem.ratio
        console.log('end', end)
        let toEnd = toItems[firstItemIndex].offsetTop
        if (firstItemIndex !== 0) {
            // start = fromItem[firstItemIndex - 1].offsetTop
            start = from.clientHeight * sourceItem[firstItemIndex - 1].ratio
            toStart = toItems[firstItemIndex - 1].offsetTop
        }

        const ratio = (from.scrollTop - start) / (end - start)
        to.scrollTop = toStart + (toEnd - toStart) * ratio
    }
}

function getAnchorForMDSource(dom: HTMLDivElement) {
    // 由于 cm 有回收和重用 dom 的机制，所以获取不正确
    const lines = Array.from(dom.querySelectorAll('.cm-line'));
    const headings = lines.filter((l) => {
        return l.textContent?.startsWith('# ') ||
            l.textContent?.startsWith('## ') ||
            l.textContent?.startsWith('### ') ||
            l.textContent?.startsWith('#### ') ||
            l.textContent?.startsWith('##### ') ||
            l.textContent?.startsWith('###### ')
    })

    return headings as HTMLElement[]
}

// 从源文件中获取标题
// 注意，源文件的标题位置不能映射为编辑器的位置，因为编辑器里存在多行文本对应一行源文件的情况
function getAnchorForSource(s: string) {
    let lines = s.split("\n");
    const lineNum = lines.length
    return lines.map((i, j) => ({content: i, ratio: j / lineNum})).filter((l) => {
        const content = l.content
        return content.startsWith('# ') || content.startsWith('## ') || content.startsWith('### ') || content.startsWith('#### ') || content.startsWith('##### ') || content.startsWith('###### ')
    })
}

function getAnchorForMDPreview(dom: HTMLDivElement) {
    const headings = Array.from(dom.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    // console.log('headings', headings)
    return headings as HTMLElement[]

}

export default App;
