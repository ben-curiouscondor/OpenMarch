import { useEffect, useState } from "react";
import { useSelectedMarcher } from "../../../context/SelectedMarcherContext";
import { useSelectedPage } from "../../../context/SelectedPageContext";
import { bsconfig } from "../../../styles/bootstrapClasses";
import { useMarcherStore, usePageStore } from "../../../stores/Store";
import { MarcherPage } from "../../../Interfaces";
import { getMarcherPages } from "../../../api/api";
import { Container, Row, Col, Table } from "react-bootstrap";

export function MarcherPageList() {
    const [isLoading, setIsLoading] = useState(true);
    const selectedPage = useSelectedPage()?.selectedPage || null;
    const selectedMarcher = useSelectedMarcher()?.selectedMarcher || null;
    const marchers = useMarcherStore(state => state.marchers);
    const pages = usePageStore(state => state.pages);
    const [marcherPages, setMarcherPages] = useState<MarcherPage[]>([]);
    const [attributes, setAttributes] = useState<string[]>
        ([selectedMarcher?.drill_number || "Pg " + selectedPage?.name || "Name", "X", "Y"]);

    // Load marcherPage(s) from selected marcher/page
    useEffect(() => {
        setMarcherPages([]);
        setIsLoading(true);
        // If both a marcher and page is selected return a single marcherPage
        if (selectedPage || selectedMarcher) {
            const idToUse = selectedPage?.id_for_html || selectedMarcher!.id_for_html;
            getMarcherPages(idToUse).then((marcherPagesResponse: MarcherPage[]) => {
                setMarcherPages(marcherPagesResponse);
            }).finally(() => {
                setIsLoading(false)
            });
        }
        setIsLoading(false);
        const newAttributes = attributes;
        newAttributes[0] = selectedMarcher?.drill_number || selectedPage?.name || "Name";
        if (selectedPage)
            newAttributes[0] = "Pg " + newAttributes[0];
        setAttributes(newAttributes);
    }
        , [selectedPage, selectedMarcher]);

    // Accessor functions for marchers and pages
    const getMarcher = (marcher_id: number) => {
        return marchers.find(marcher => marcher.id === marcher_id);
    }
    const getMarcherNumber = (marcher_id: number) => {
        return (getMarcher(marcher_id)?.drill_number) || "-";
    }

    const getPage = (page_id: number) => {
        return pages.find(page => page.id === page_id);
    }
    const getPageName = (page_id: number) => {
        return (getPage(page_id)?.name) || "-";
    }
    return (
        <>
            <Container className="text-left --bs-primary">
                <Row className={bsconfig.tableHeader}>
                    {attributes.map((attribute) => (
                        <Col className="table-header" key={"pageHeader-" + attribute}>
                            {attribute}
                        </Col>
                    ))}
                </Row>
            </Container>
            <div className="scrollable">
                <Table className="user-select-none">
                    <tbody>
                        {isLoading ? (<tr><td>Loading...</td></tr>) : (
                            marcherPages.length === 0 ? <tr><td>No marchers found</td></tr> :
                                marcherPages.map((marcherPage) => (
                                    <tr key={marcherPage.id_for_html} id={marcherPage.id_for_html}>
                                        <th scope="row" className="text-start">{selectedPage ?
                                            getMarcherNumber(marcherPage.marcher_id) :
                                            getPageName(marcherPage.page_id)}
                                        </th>
                                        <td>{marcherPage?.x || "nil"}</td>
                                        <td>{marcherPage?.y || "nil"}</td>
                                        {/* <td>{marcher.}</td> */}
                                    </tr>
                                ))
                        )}
                    </tbody>
                </Table>
            </div>
        </>
    );
}
