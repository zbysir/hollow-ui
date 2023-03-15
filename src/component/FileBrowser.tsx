import {FileI} from "./FileEditor";
import {KeyValuePair} from "tailwindcss/types/config";
import {MouseEvent, useEffect, useRef, useState} from "react";
import {MenuVertical} from "./MenuVertical";
import ReactDOM from "react-dom/client";
import {Menu} from "./Menu";
import {MenuI} from "./Header";
import {DocumentIcon, DocumentTextIcon, FolderIcon, FolderOpenIcon} from "../icon";
import {ShowPopupMenu} from "../util/popupMenu";
import {FileStatus} from "../App";

export interface FileTreeI extends FileI {
    items?: FileTreeI[]
}

function FileIcon({iconKey, size}: { iconKey: string, size: number }) {
    const url = './icons/' + ({
        dir: 'folder',
        diropen: 'folder_open',
        tsx: 'typescript',
        ts: 'typescript',
        md: 'markdown',
        js: 'javascript',
        jsx: 'javascript',
        sh: 'powershell',
        yml: 'yaml',
        png: 'image',
        jpeg: 'image',
        jpg: 'image',
    }[iconKey] || iconKey) + '.svg'
    return <div className={"shrink-0"} style={{backgroundImage: `url("${url}")`, width: size + 'px', height: size + 'px'}}></div>
}

function FileTree(props: Props) {
    const menuDom = useRef<Element>()

    useEffect(() => {
        const c = () => {
            menuDom.current?.remove()
        }
        document.addEventListener('click', c)

        return () => {
            document.removeEventListener('click', c)
        }
    })

    const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()

        ShowPopupMenu({
            x: e.clientX,
            y: e.clientY,
            menu: [
                {name: "New File", key: "new file"},
                {name: "New Directory", key: "new directory"},
                {name: "Open", key: "open"},
                {name: "Delete", key: "delete"},
            ],
            onClick: (m) => {
                props.onMenu && props.onMenu(m, props.tree!)
            },
            id: ""
        })
    }

    let iconKey = 'default'
    let dirOpen = false
    if (props.tree?.is_dir) {
        iconKey = 'dir'
        dirOpen = !!props.status?.openedDir?.find((i => (props.tree?.path === i.path)))
        if (dirOpen) {
            iconKey = 'diropen'
        }
    } else {
        const eindex = props.tree?.name.lastIndexOf(".")
        if (eindex && eindex >= 0) {
            iconKey = props.tree?.name.substr(eindex + 1).toLowerCase()!
        }
    }
    const icon = <FileIcon iconKey={iconKey} size={14}></FileIcon>

    return <>
        {props.tree?.name === "" && props.tree?.path === "" ?
            <div
                className="min-h-8 select-none inline-block"
                onContextMenu={handleContextMenu}
            >
                {
                    props.tree?.items?.map(i => (
                        <FileTree key={i.name} {...props} tree={i}></FileTree>
                    ))
                }
            </div>
            :
            <>
                <div
                    onClick={() => {
                        props.onFileClick && props.onFileClick(props.tree!)
                    }}
                    className={
                        `px-1 cursor-pointer rounded-sm inline-flex items-center text-gray-400 hover:text-current
                         w-full
                         ${props.status?.currFile?.path === props.tree?.path ? 'bg-gray-600 text-current' : ''}
                         `}
                    onContextMenu={handleContextMenu}
                >
                    {icon}
                    <span className="ml-2 py-0.5 flex-1 whitespace-nowrap">{props.tree?.name}</span>
                </div>
                {
                    dirOpen ?
                        <div className="pl-4">
                            {
                                props.tree?.items?.map(i => (
                                    <FileTree key={i.name} {...props} tree={i}></FileTree>
                                ))
                            }
                        </div> : null
                }

            </>
        }
    </>
}


interface Props {
    tree?: FileTreeI
    onFileClick?: (f: FileI) => void
    onMenu?: (m: MenuI, f: FileTreeI) => void
    status?: FileStatus
}

export default function FileBrowser(props: Props) {
    const handleContextMenu = function () {
    }
    return <div className="text-sm p-2 h-full inline-block"
                onContextMenu={handleContextMenu}
    >
        <FileTree {...props}></FileTree>
    </div>
}